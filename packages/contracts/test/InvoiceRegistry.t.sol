// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

/// @notice Minimal ERC-20 mock for ERC-20 payment path tests.
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "ERC20: allowance");
        require(balanceOf[from] >= amount, "ERC20: balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract InvoiceRegistryTest is Test {
    InvoiceRegistry public registry;
    MockERC20 public token;

    address public issuer = makeAddr("issuer");
    address public payer = makeAddr("payer");
    address public stranger = makeAddr("stranger");

    bytes32 constant MEMO_HASH = keccak256("memo");
    string constant MEMO_URI = "ipfs://memo";

    receive() external payable {}

    function setUp() public {
        registry = new InvoiceRegistry();
        token = new MockERC20();

        vm.deal(payer, 10 ether);
        vm.deal(stranger, 10 ether);
        token.mint(payer, 1_000_000 * 1e6);
    }

    // =========================================================================
    // createInvoice
    // =========================================================================

    function test_createInvoice_eth_emits_and_stores() public {
        vm.prank(issuer);
        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.InvoiceCreated(
            1, issuer, payer, address(0), 1 ether, 0, 0, 0, MEMO_URI, MEMO_HASH
        );
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        assertEq(id, 1);
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(id);
        assertEq(inv.issuer, issuer);
        assertEq(inv.payer, payer);
        assertEq(inv.amount, 1 ether);
        assertEq(inv.token, address(0));
        assertEq(uint256(inv.status), uint256(InvoiceRegistry.Status.Issued));
    }

    function test_createInvoice_reverts_on_zero_payer() public {
        vm.prank(issuer);
        vm.expectRevert(InvoiceRegistry.ZeroAddress.selector);
        registry.createInvoice(address(0), 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);
    }

    function test_createInvoice_reverts_on_zero_amount() public {
        vm.prank(issuer);
        vm.expectRevert(InvoiceRegistry.ZeroAmount.selector);
        registry.createInvoice(payer, 0, 0, address(0), 0, 0, MEMO_URI, MEMO_HASH);
    }

    function test_createInvoice_reverts_on_empty_memo() public {
        vm.prank(issuer);
        vm.expectRevert(InvoiceRegistry.EmptyMemoURI.selector);
        registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, "", MEMO_HASH);
    }

    function test_createInvoice_ids_increment() public {
        vm.startPrank(issuer);
        uint256 a = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);
        uint256 b = registry.createInvoice(payer, 0, 0, address(0), 2 ether, 0, MEMO_URI, MEMO_HASH);
        vm.stopPrank();
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(registry.nextInvoiceId(), 3);
    }

    // =========================================================================
    // payInvoiceETH
    // =========================================================================

    function test_payInvoiceETH_success() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        uint256 issuerBalanceBefore = issuer.balance;

        vm.prank(payer);
        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.InvoicePaid(id, issuer, payer, address(0), 1 ether);
        registry.payInvoiceETH{value: 1 ether}(id);

        assertEq(issuer.balance - issuerBalanceBefore, 1 ether);
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(id);
        assertEq(uint256(inv.status), uint256(InvoiceRegistry.Status.Paid));
    }

    function test_payInvoiceETH_reverts_wrong_amount() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(InvoiceRegistry.WrongAmount.selector, 1 ether, 0.5 ether)
        );
        registry.payInvoiceETH{value: 0.5 ether}(id);
    }

    function test_payInvoiceETH_reverts_wrong_token() public {
        // Create an ERC-20 invoice, then try to pay as ETH.
        vm.prank(issuer);
        uint256 id =
            registry.createInvoice(payer, 0, 0, address(token), 1_000 * 1e6, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        vm.expectRevert();
        registry.payInvoiceETH{value: 1 ether}(id);
    }

    function test_payInvoiceETH_reverts_invoice_not_found() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(InvoiceRegistry.InvoiceNotFound.selector, 999));
        registry.payInvoiceETH{value: 1 ether}(999);
    }

    function test_payInvoiceETH_reverts_already_paid() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        registry.payInvoiceETH{value: 1 ether}(id);

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(InvoiceRegistry.InvoiceNotIssued.selector, id));
        registry.payInvoiceETH{value: 1 ether}(id);
    }

    // =========================================================================
    // payInvoiceERC20
    // =========================================================================

    function test_payInvoiceERC20_success() public {
        vm.prank(issuer);
        uint256 id =
            registry.createInvoice(payer, 0, 0, address(token), 1_000 * 1e6, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        token.approve(address(registry), 1_000 * 1e6);

        vm.prank(payer);
        registry.payInvoiceERC20(id);

        assertEq(token.balanceOf(issuer), 1_000 * 1e6);
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(id);
        assertEq(uint256(inv.status), uint256(InvoiceRegistry.Status.Paid));
    }

    function test_payInvoiceERC20_reverts_without_approval() public {
        vm.prank(issuer);
        uint256 id =
            registry.createInvoice(payer, 0, 0, address(token), 1_000 * 1e6, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        vm.expectRevert();
        registry.payInvoiceERC20(id);
    }

    function test_payInvoiceERC20_reverts_on_eth_invoice() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        vm.expectRevert();
        registry.payInvoiceERC20(id);
    }

    // =========================================================================
    // cancelInvoice
    // =========================================================================

    function test_cancelInvoice_success() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(issuer);
        vm.expectEmit(true, true, false, false);
        emit InvoiceRegistry.InvoiceCancelled(id, issuer);
        registry.cancelInvoice(id);

        InvoiceRegistry.Invoice memory inv = registry.getInvoice(id);
        assertEq(uint256(inv.status), uint256(InvoiceRegistry.Status.Cancelled));
    }

    function test_cancelInvoice_only_issuer() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(InvoiceRegistry.NotInvoiceIssuer.selector, id, stranger)
        );
        registry.cancelInvoice(id);
    }

    function test_cancelInvoice_reverts_if_already_paid() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        registry.payInvoiceETH{value: 1 ether}(id);

        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(InvoiceRegistry.InvoiceNotIssued.selector, id));
        registry.cancelInvoice(id);
    }

    // =========================================================================
    // requestInvoice
    // =========================================================================

    function test_requestInvoice_emits_event() public {
        vm.prank(payer);
        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.InvoiceRequested(1, payer, issuer, address(0), 1 ether, MEMO_URI);
        uint256 reqId = registry.requestInvoice(issuer, address(0), 1 ether, MEMO_URI);
        assertEq(reqId, 1);
        assertEq(registry.nextRequestId(), 2);
    }

    function test_requestInvoice_reverts_on_zero_issuer() public {
        vm.prank(payer);
        vm.expectRevert(InvoiceRegistry.ZeroAddress.selector);
        registry.requestInvoice(address(0), address(0), 1 ether, MEMO_URI);
    }

    function test_requestInvoice_reverts_on_zero_amount() public {
        vm.prank(payer);
        vm.expectRevert(InvoiceRegistry.ZeroAmount.selector);
        registry.requestInvoice(issuer, address(0), 0, MEMO_URI);
    }

    // =========================================================================
    // statusOf + independence
    // =========================================================================

    function test_statusOf_returns_correct_state() public {
        vm.prank(issuer);
        uint256 id = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);
        assertEq(uint256(registry.statusOf(id)), uint256(InvoiceRegistry.Status.Issued));

        vm.prank(payer);
        registry.payInvoiceETH{value: 1 ether}(id);
        assertEq(uint256(registry.statusOf(id)), uint256(InvoiceRegistry.Status.Paid));
    }

    function test_multiple_invoices_independent() public {
        vm.prank(issuer);
        uint256 a = registry.createInvoice(payer, 0, 0, address(0), 1 ether, 0, MEMO_URI, MEMO_HASH);
        vm.prank(issuer);
        uint256 b = registry.createInvoice(payer, 0, 0, address(0), 2 ether, 0, MEMO_URI, MEMO_HASH);

        vm.prank(payer);
        registry.payInvoiceETH{value: 1 ether}(a);

        assertEq(uint256(registry.statusOf(a)), uint256(InvoiceRegistry.Status.Paid));
        assertEq(uint256(registry.statusOf(b)), uint256(InvoiceRegistry.Status.Issued));
    }
}
