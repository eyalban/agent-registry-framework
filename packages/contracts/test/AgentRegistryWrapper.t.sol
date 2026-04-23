// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgentRegistryWrapper} from "../src/AgentRegistryWrapper.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

/**
 * @title AgentRegistryWrapperTest
 * @notice Unit tests for the AgentRegistryWrapper contract.
 */
contract AgentRegistryWrapperTest is Test {
    AgentRegistryWrapper public wrapper;
    address public mockRegistry;
    address public deployer;
    address public user1;
    address public user2;

    uint256 public constant REGISTRATION_FEE = 0.001 ether;

    // Allow this contract to receive ETH from withdraw()
    receive() external payable {}

    function setUp() public {
        deployer = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Deploy a mock identity registry
        mockRegistry = address(new MockIdentityRegistry());

        // Deploy wrapper
        wrapper = new AgentRegistryWrapper(mockRegistry, REGISTRATION_FEE);

        // Fund test accounts
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_constructor_setsIdentityRegistry() public view {
        assertEq(address(wrapper.identityRegistry()), mockRegistry);
    }

    function test_constructor_setsRegistrationFee() public view {
        assertEq(wrapper.registrationFee(), REGISTRATION_FEE);
    }

    function test_constructor_setsOwner() public view {
        assertEq(wrapper.owner(), deployer);
    }

    // =========================================================================
    // Registration Tests
    // =========================================================================

    function test_registerAgent_success() public {
        string[] memory tags = new string[](2);
        tags[0] = "defi";
        tags[1] = "trading";

        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(user1);
        uint256 agentId = wrapper.registerAgent{value: REGISTRATION_FEE}(
            "ipfs://QmTest123",
            metadata,
            tags
        );

        assertEq(agentId, 1);

        string[] memory storedTags = wrapper.agentTags(agentId);
        assertEq(storedTags.length, 2);
        assertEq(storedTags[0], "defi");
        assertEq(storedTags[1], "trading");
    }

    function test_registerAgent_emitsEvent() public {
        string[] memory tags = new string[](1);
        tags[0] = "ai";

        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit AgentRegistryWrapper.AgentRegisteredViaWrapper(1, user1, tags);

        wrapper.registerAgent{value: REGISTRATION_FEE}(
            "ipfs://QmTest123",
            metadata,
            tags
        );
    }

    function test_registerAgent_revert_insufficientFee() public {
        string[] memory tags = new string[](0);
        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRegistryWrapper.InsufficientFee.selector,
                REGISTRATION_FEE,
                0
            )
        );
        wrapper.registerAgent("ipfs://QmTest123", metadata, tags);
    }

    function test_registerAgent_revert_tooManyTags() public {
        string[] memory tags = new string[](11);
        for (uint256 i = 0; i < 11; i++) {
            tags[i] = "tag";
        }

        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRegistryWrapper.TooManyTags.selector,
                11,
                10
            )
        );
        wrapper.registerAgent{value: REGISTRATION_FEE}(
            "ipfs://QmTest123",
            metadata,
            tags
        );
    }

    function test_registerAgent_revert_tagTooLong() public {
        string[] memory tags = new string[](1);
        // 33 bytes - exceeds MAX_TAG_LENGTH of 32
        tags[0] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(user1);
        vm.expectRevert();
        wrapper.registerAgent{value: REGISTRATION_FEE}(
            "ipfs://QmTest123",
            metadata,
            tags
        );
    }

    function test_registerAgent_zeroFee() public {
        // Set fee to 0
        wrapper.setRegistrationFee(0);

        string[] memory tags = new string[](0);
        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        vm.prank(user1);
        uint256 agentId = wrapper.registerAgent(
            "ipfs://QmTest123",
            metadata,
            tags
        );
        assertEq(agentId, 1);
    }

    // =========================================================================
    // Tag Management Tests
    // =========================================================================

    function test_updateTags_success() public {
        // First register
        _registerAgent(user1, "defi");

        string[] memory newTags = new string[](2);
        newTags[0] = "nft";
        newTags[1] = "gaming";

        vm.prank(user1, user1);
        wrapper.updateTags(1, newTags);

        string[] memory stored = wrapper.agentTags(1);
        assertEq(stored.length, 2);
        assertEq(stored[0], "nft");
    }

    function test_updateTags_revert_notOwner() public {
        _registerAgent(user1, "defi");

        string[] memory newTags = new string[](1);
        newTags[0] = "hacked";

        vm.prank(user2);
        vm.expectRevert();
        wrapper.updateTags(1, newTags);
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_setFeatured_success() public {
        _registerAgent(user1, "defi");

        wrapper.setFeatured(1, true);
        assertTrue(wrapper.isFeatured(1));

        wrapper.setFeatured(1, false);
        assertFalse(wrapper.isFeatured(1));
    }

    function test_setFeatured_revert_notOwner() public {
        _registerAgent(user1, "defi");

        vm.prank(user1);
        vm.expectRevert();
        wrapper.setFeatured(1, true);
    }

    function test_setRegistrationFee() public {
        uint256 newFee = 0.01 ether;
        wrapper.setRegistrationFee(newFee);
        assertEq(wrapper.registrationFee(), newFee);
    }

    function test_withdraw() public {
        // Register to accumulate fees
        _registerAgent(user1, "defi");
        _registerAgent(user2, "trading");

        uint256 balanceBefore = deployer.balance;
        wrapper.withdraw();
        uint256 balanceAfter = deployer.balance;

        assertEq(balanceAfter - balanceBefore, REGISTRATION_FEE * 2);
    }

    // =========================================================================
    // Activity Tests
    // =========================================================================

    function test_recordActivity() public {
        _registerAgent(user1, "defi");

        vm.roll(100);
        vm.prank(user1, user1);
        wrapper.recordActivity(1);

        assertEq(wrapper.lastActivityBlock(1), 100);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _registerAgent(address user, string memory tag) internal returns (uint256) {
        string[] memory tags = new string[](1);
        tags[0] = tag;

        IIdentityRegistry.MetadataEntry[] memory metadata =
            new IIdentityRegistry.MetadataEntry[](0);

        // Set both msg.sender and tx.origin so mock registry
        // records correct owner via tx.origin
        vm.prank(user, user);
        return wrapper.registerAgent{value: REGISTRATION_FEE}(
            "ipfs://QmTest123",
            metadata,
            tags
        );
    }
}

/**
 * @title MockIdentityRegistry
 * @notice Minimal mock for testing the wrapper contract.
 *         Simulates the canonical behavior: _safeMint to msg.sender (the wrapper),
 *         then the wrapper calls transferFrom to send the NFT to the end user.
 */
contract MockIdentityRegistry {
    uint256 private _nextId = 1;
    mapping(uint256 => address) private _owners;

    function register(
        string calldata,
        IIdentityRegistry.MetadataEntry[] calldata
    ) external returns (uint256) {
        uint256 agentId = _nextId++;
        // Mint to msg.sender (the wrapper contract), matching canonical behavior
        _owners[agentId] = msg.sender;
        return agentId;
    }

    function register(string calldata) external returns (uint256) {
        uint256 agentId = _nextId++;
        _owners[agentId] = msg.sender;
        return agentId;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function tokenURI(uint256) external pure returns (string memory) {
        return "ipfs://QmTest123";
    }

    function transferFrom(address, address to, uint256 tokenId) external {
        _owners[tokenId] = to;
    }

    function setAgentURI(uint256, string calldata) external {}
    function setMetadata(uint256, string calldata, bytes calldata) external {}
    function getMetadata(uint256, string calldata) external pure returns (bytes memory) {
        return "";
    }
    function getAgentWallet(uint256) external pure returns (address) {
        return address(0);
    }
}
