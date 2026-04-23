// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal ERC-20 interface — only the functions InvoiceRegistry needs.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title InvoiceRegistry
 * @author Statemate Team
 * @notice On-chain invoicing primitive for agents and agentic companies.
 *         Invoices are created by an issuer, targeted at a specific payer,
 *         denominated in ETH or a single ERC-20. Payment is atomic: the
 *         contract validates the amount, transfers funds to the issuer, and
 *         marks the invoice Paid in one transaction. Unpaid invoices surface
 *         as accounts-receivable (issuer) / accounts-payable (payer) in the
 *         financial statements.
 *
 *         Also supports "invoice requests" — agent A asks agent B to issue
 *         an invoice for an agreed amount/service, emitted as an event that
 *         clients can surface and B can fulfill via `createInvoice`.
 *
 * @dev No reentrancy guard OZ dependency; state updates precede external
 *      calls, and we use `.call` for ETH with a bool check. For safety we
 *      still checkstate before/after external calls.
 */
contract InvoiceRegistry {
    // =========================================================================
    // Types
    // =========================================================================

    enum Status {
        Issued,
        Paid,
        Cancelled
    }

    struct Invoice {
        address issuer;
        address payer;
        uint256 issuerCompanyId; // 0 = no company
        uint256 payerCompanyId;  // 0 = no company
        address token;           // address(0) = native ETH
        uint256 amount;          // raw token units
        uint256 dueBlock;        // 0 = no due date
        bytes32 memoHash;        // sha256 of off-chain memo for integrity
        string memoURI;          // IPFS or https
        Status status;
        uint256 issuedAt;
        uint256 paidAt;
        bytes32 paidTxHash;      // set when paid
    }

    // =========================================================================
    // Errors
    // =========================================================================

    error InvoiceNotFound(uint256 id);
    error InvoiceNotIssued(uint256 id);
    error NotInvoiceIssuer(uint256 id, address caller);
    error WrongAmount(uint256 expected, uint256 provided);
    error WrongToken(address expected, address provided);
    error InvoicePaymentFailed();
    error ZeroAmount();
    error ZeroAddress();
    error EmptyMemoURI();

    // =========================================================================
    // Events
    // =========================================================================

    event InvoiceCreated(
        uint256 indexed id,
        address indexed issuer,
        address indexed payer,
        address token,
        uint256 amount,
        uint256 issuerCompanyId,
        uint256 payerCompanyId,
        uint256 dueBlock,
        string memoURI,
        bytes32 memoHash
    );

    event InvoicePaid(
        uint256 indexed id,
        address indexed issuer,
        address indexed payer,
        address token,
        uint256 amount
    );

    event InvoiceCancelled(uint256 indexed id, address indexed issuer);

    event InvoiceRequested(
        uint256 indexed requestId,
        address indexed requester,
        address indexed issuerSuggested,
        address token,
        uint256 amount,
        string memoURI
    );

    // =========================================================================
    // State
    // =========================================================================

    mapping(uint256 id => Invoice) public invoices;
    uint256 public nextInvoiceId = 1;
    uint256 public nextRequestId = 1;

    // =========================================================================
    // Core
    // =========================================================================

    /**
     * @notice Issue a new invoice.
     * @param payer      Address expected to pay.
     * @param issuerCompanyId Issuer's company id (0 = none).
     * @param payerCompanyId  Payer's company id (0 = none).
     * @param token      Payment token (`address(0)` for ETH).
     * @param amount     Raw token units.
     * @param dueBlock   Optional due block (0 = no due date).
     * @param memoURI    Off-chain memo (IPFS/https).
     * @param memoHash   sha256 of memo JSON for integrity.
     * @return id The newly created invoice id.
     */
    function createInvoice(
        address payer,
        uint256 issuerCompanyId,
        uint256 payerCompanyId,
        address token,
        uint256 amount,
        uint256 dueBlock,
        string calldata memoURI,
        bytes32 memoHash
    )
        external
        returns (uint256 id)
    {
        if (payer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (bytes(memoURI).length == 0) revert EmptyMemoURI();

        id = nextInvoiceId++;
        Invoice storage inv = invoices[id];
        inv.issuer = msg.sender;
        inv.payer = payer;
        inv.issuerCompanyId = issuerCompanyId;
        inv.payerCompanyId = payerCompanyId;
        inv.token = token;
        inv.amount = amount;
        inv.dueBlock = dueBlock;
        inv.memoHash = memoHash;
        inv.memoURI = memoURI;
        inv.status = Status.Issued;
        inv.issuedAt = block.timestamp;

        emit InvoiceCreated(
            id, msg.sender, payer, token, amount, issuerCompanyId, payerCompanyId, dueBlock, memoURI, memoHash
        );
    }

    /**
     * @notice Pay an ETH-denominated invoice. msg.value must equal the amount.
     */
    function payInvoiceETH(uint256 id) external payable {
        Invoice storage inv = invoices[id];
        if (inv.issuer == address(0)) revert InvoiceNotFound(id);
        if (inv.status != Status.Issued) revert InvoiceNotIssued(id);
        if (inv.token != address(0)) revert WrongToken(inv.token, address(0));
        if (msg.value != inv.amount) revert WrongAmount(inv.amount, msg.value);

        // Effects before external call.
        inv.status = Status.Paid;
        inv.paidAt = block.timestamp;
        inv.paidTxHash = blockhash(block.number - 1); // best-effort identifier;
            // the real tx hash is emitted by the network

        // Forward ETH to issuer.
        (bool ok,) = inv.issuer.call{ value: msg.value }("");
        if (!ok) revert InvoicePaymentFailed();

        emit InvoicePaid(id, inv.issuer, msg.sender, inv.token, inv.amount);
    }

    /**
     * @notice Pay an ERC-20-denominated invoice. Requires prior `approve` from
     *         msg.sender on the token contract for at least `amount`.
     */
    function payInvoiceERC20(uint256 id) external {
        Invoice storage inv = invoices[id];
        if (inv.issuer == address(0)) revert InvoiceNotFound(id);
        if (inv.status != Status.Issued) revert InvoiceNotIssued(id);
        if (inv.token == address(0)) revert WrongToken(inv.token, address(0));

        // Effects before external call.
        inv.status = Status.Paid;
        inv.paidAt = block.timestamp;
        inv.paidTxHash = blockhash(block.number - 1);

        bool ok = IERC20(inv.token).transferFrom(msg.sender, inv.issuer, inv.amount);
        if (!ok) revert InvoicePaymentFailed();

        emit InvoicePaid(id, inv.issuer, msg.sender, inv.token, inv.amount);
    }

    /**
     * @notice Cancel an outstanding invoice. Only the issuer may cancel, and
     *         only while the invoice is still Issued.
     */
    function cancelInvoice(uint256 id) external {
        Invoice storage inv = invoices[id];
        if (inv.issuer == address(0)) revert InvoiceNotFound(id);
        if (inv.status != Status.Issued) revert InvoiceNotIssued(id);
        if (inv.issuer != msg.sender) revert NotInvoiceIssuer(id, msg.sender);

        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    /**
     * @notice Request an invoice from a counterparty. Emits only — no stored
     *         state — so the other side can observe and fulfill via
     *         `createInvoice`. Useful as a handshake for one-off services.
     */
    function requestInvoice(
        address issuerSuggested,
        address token,
        uint256 amount,
        string calldata memoURI
    )
        external
        returns (uint256 requestId)
    {
        if (issuerSuggested == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (bytes(memoURI).length == 0) revert EmptyMemoURI();

        requestId = nextRequestId++;
        emit InvoiceRequested(requestId, msg.sender, issuerSuggested, token, amount, memoURI);
    }

    // =========================================================================
    // Views
    // =========================================================================

    function getInvoice(uint256 id) external view returns (Invoice memory) {
        return invoices[id];
    }

    function statusOf(uint256 id) external view returns (Status) {
        return invoices[id].status;
    }
}
