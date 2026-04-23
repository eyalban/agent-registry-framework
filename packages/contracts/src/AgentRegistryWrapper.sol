// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/**
 * @title AgentRegistryWrapper
 * @author Statemate Team
 * @notice Thin wrapper around the canonical ERC-8004 Identity Registry that adds
 *         app-specific features: discovery tags, registration fees, featured agents,
 *         and activity tracking.
 * @dev All core identity logic remains in the canonical contract. This wrapper
 *      preserves full ERC-8004 interoperability — agents registered through this
 *      contract are discoverable by any ERC-8004-compatible tool.
 */
/**
 * @title IERC721Receiver
 * @dev Interface for receiving ERC-721 tokens via safeTransferFrom.
 */
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract AgentRegistryWrapper is IERC721Receiver {
    // =========================================================================
    // Errors
    // =========================================================================

    /// @dev Thrown when msg.value is less than the registration fee
    error InsufficientFee(uint256 required, uint256 provided);

    /// @dev Thrown when too many tags are provided
    error TooManyTags(uint256 provided, uint256 max);

    /// @dev Thrown when a single tag exceeds the max length
    error TagTooLong(string tag, uint256 maxLength);

    /// @dev Thrown when the caller is not the owner of the agent
    error NotAgentOwner(uint256 agentId, address caller);

    /// @dev Thrown when the caller is not the contract owner
    error NotContractOwner(address caller);

    /// @dev Thrown when a withdrawal fails
    error WithdrawalFailed();

    // =========================================================================
    // Events
    // =========================================================================

    /// @notice Emitted when an agent is registered via this wrapper
    event AgentRegisteredViaWrapper(
        uint256 indexed agentId,
        address indexed owner,
        string[] tags
    );

    /// @notice Emitted when an agent's tags are updated
    event AgentTagsUpdated(uint256 indexed agentId, string[] tags);

    /// @notice Emitted when an agent's featured status changes
    event AgentFeatured(uint256 indexed agentId, bool featured);

    /// @notice Emitted when activity is recorded for an agent
    event AgentActivityRecorded(uint256 indexed agentId, uint256 blockNumber);

    /// @notice Emitted when the registration fee is updated
    event RegistrationFeeUpdated(uint256 oldFee, uint256 newFee);

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Maximum number of tags per agent
    uint256 public constant MAX_TAGS = 10;

    /// @notice Maximum length of a single tag in bytes
    uint256 public constant MAX_TAG_LENGTH = 32;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice The canonical ERC-8004 Identity Registry
    IIdentityRegistry public immutable identityRegistry;

    /// @notice Contract owner (deployer)
    address public owner;

    /// @notice Fee required to register an agent (in wei)
    uint256 public registrationFee;

    /// @notice Tags associated with each agent
    mapping(uint256 agentId => string[] tags) private _agentTags;

    /// @notice Whether an agent is featured
    mapping(uint256 agentId => bool) public isFeatured;

    /// @notice Last block in which activity was recorded for an agent
    mapping(uint256 agentId => uint256 blockNum) public lastActivityBlock;

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param _identityRegistry Address of the canonical ERC-8004 Identity Registry
    /// @param _registrationFee Initial registration fee in wei (can be 0)
    constructor(address _identityRegistry, uint256 _registrationFee) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        registrationFee = _registrationFee;
        owner = msg.sender;
    }

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotContractOwner(msg.sender);
        _;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        if (identityRegistry.ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId, msg.sender);
        }
        _;
    }

    // =========================================================================
    // Registration
    // =========================================================================

    /**
     * @notice Register a new agent via the canonical Identity Registry with
     *         additional discovery tags.
     * @param agentURI URI pointing to the agent's ERC-8004 registration file
     * @param metadata Initial metadata key-value pairs
     * @param tags Discovery tags for categorization (max 10, each max 32 bytes)
     * @return agentId The newly minted agent's token ID
     */
    function registerAgent(
        string calldata agentURI,
        IIdentityRegistry.MetadataEntry[] calldata metadata,
        string[] calldata tags
    ) external payable returns (uint256 agentId) {
        // Check fee
        if (msg.value < registrationFee) {
            revert InsufficientFee(registrationFee, msg.value);
        }

        // Validate tags
        _validateTags(tags);

        // Register on canonical contract.
        // The canonical register() uses _safeMint(msg.sender, ...), so the
        // NFT is initially minted to this wrapper contract. We then transfer
        // it to the actual caller so they own the agent identity.
        agentId = identityRegistry.register(agentURI, metadata);

        // Transfer the NFT from this contract to the actual caller
        identityRegistry.transferFrom(address(this), msg.sender, agentId);

        // Store tags
        _agentTags[agentId] = tags;

        // Track activity
        lastActivityBlock[agentId] = block.number;

        emit AgentRegisteredViaWrapper(agentId, msg.sender, tags);
    }

    // =========================================================================
    // Tag Management
    // =========================================================================

    /**
     * @notice Update the tags for an agent. Only callable by agent owner.
     * @param agentId The agent's token ID
     * @param tags New set of tags (replaces existing)
     */
    function updateTags(
        uint256 agentId,
        string[] calldata tags
    ) external onlyAgentOwner(agentId) {
        _validateTags(tags);
        _agentTags[agentId] = tags;
        lastActivityBlock[agentId] = block.number;
        emit AgentTagsUpdated(agentId, tags);
    }

    /**
     * @notice Get tags for an agent.
     * @param agentId The agent's token ID
     * @return The agent's tags
     */
    function agentTags(uint256 agentId) external view returns (string[] memory) {
        return _agentTags[agentId];
    }

    // =========================================================================
    // Activity Tracking
    // =========================================================================

    /**
     * @notice Record activity for an agent. Only callable by agent owner.
     * @param agentId The agent's token ID
     */
    function recordActivity(uint256 agentId) external onlyAgentOwner(agentId) {
        lastActivityBlock[agentId] = block.number;
        emit AgentActivityRecorded(agentId, block.number);
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set an agent as featured or unfeatured. Only callable by contract owner.
     * @param agentId The agent's token ID
     * @param featured Whether the agent should be featured
     */
    function setFeatured(uint256 agentId, bool featured) external onlyOwner {
        isFeatured[agentId] = featured;
        emit AgentFeatured(agentId, featured);
    }

    /**
     * @notice Update the registration fee. Only callable by contract owner.
     * @param newFee The new fee in wei
     */
    function setRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = registrationFee;
        registrationFee = newFee;
        emit RegistrationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Withdraw accumulated fees. Only callable by contract owner.
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success,) = owner.call{value: balance}("");
        if (!success) revert WithdrawalFailed();
    }

    /**
     * @notice Transfer ownership of the wrapper contract.
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _validateTags(string[] calldata tags) internal pure {
        if (tags.length > MAX_TAGS) {
            revert TooManyTags(tags.length, MAX_TAGS);
        }
        for (uint256 i = 0; i < tags.length; i++) {
            if (bytes(tags[i]).length > MAX_TAG_LENGTH) {
                revert TagTooLong(tags[i], MAX_TAG_LENGTH);
            }
        }
    }

    // =========================================================================
    // ERC-721 Receiver (required because Identity Registry uses _safeMint)
    // =========================================================================

    /**
     * @notice Handle receipt of ERC-721 tokens.
     * @dev The Identity Registry uses _safeMint, so this contract must
     *      implement IERC721Receiver to accept minted agent NFTs.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
