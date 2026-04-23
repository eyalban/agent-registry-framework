// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompanyRegistry} from "../src/CompanyRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

/// @notice Minimal mock of the Identity Registry — only implements `ownerOf`
///         + test helpers, which is all CompanyRegistry inspects.
contract MockIdentity {
    mapping(uint256 => address) public owners;

    function setOwner(uint256 id, address who) external {
        owners[id] = who;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return owners[id];
    }
}

contract CompanyRegistryTest is Test {
    CompanyRegistry public registry;
    MockIdentity public identity;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public treasury1 = makeAddr("treasury1");
    address public treasury2 = makeAddr("treasury2");

    function setUp() public {
        identity = new MockIdentity();
        registry = new CompanyRegistry(address(identity));
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function test_constructor_setsIdentityRegistry() public view {
        assertEq(address(registry.identityRegistry()), address(identity));
    }

    function test_constructor_reverts_on_zero_address() public {
        vm.expectRevert(CompanyRegistry.ZeroAddress.selector);
        new CompanyRegistry(address(0));
    }

    function test_nextCompanyId_starts_at_one() public view {
        assertEq(registry.nextCompanyId(), 1);
    }

    // =========================================================================
    // Create / metadata / ownership
    // =========================================================================

    function test_createCompany_emits_and_assigns_owner() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CompanyRegistry.CompanyCreated(1, alice, "ipfs://meta");
        uint256 id = registry.createCompany("ipfs://meta");

        assertEq(id, 1);
        assertEq(registry.companyOwner(1), alice);
        assertEq(registry.companyMetadataURI(1), "ipfs://meta");
        assertEq(registry.nextCompanyId(), 2);
    }

    function test_createCompany_reverts_on_empty_uri() public {
        vm.prank(alice);
        vm.expectRevert(CompanyRegistry.EmptyMetadataURI.selector);
        registry.createCompany("");
    }

    function test_updateMetadata_success() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://old");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit CompanyRegistry.CompanyMetadataUpdated(id, "ipfs://new");
        registry.updateCompanyMetadata(id, "ipfs://new");

        assertEq(registry.companyMetadataURI(id), "ipfs://new");
    }

    function test_updateMetadata_reverts_for_non_owner() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://old");

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(CompanyRegistry.NotCompanyOwner.selector, id, bob)
        );
        registry.updateCompanyMetadata(id, "ipfs://new");
    }

    function test_updateMetadata_reverts_for_nonexistent_company() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CompanyRegistry.CompanyNotFound.selector, 999)
        );
        registry.updateCompanyMetadata(999, "ipfs://new");
    }

    function test_updateMetadata_reverts_on_empty_uri() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://old");

        vm.prank(alice);
        vm.expectRevert(CompanyRegistry.EmptyMetadataURI.selector);
        registry.updateCompanyMetadata(id, "");
    }

    function test_transferOwnership_success() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit CompanyRegistry.CompanyOwnershipTransferred(id, alice, bob);
        registry.transferCompanyOwnership(id, bob);

        assertEq(registry.companyOwner(id), bob);
    }

    function test_transferOwnership_reverts_on_zero_address() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        vm.expectRevert(CompanyRegistry.ZeroAddress.selector);
        registry.transferCompanyOwnership(id, address(0));
    }

    function test_transferOwnership_reverts_for_non_owner() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(bob);
        vm.expectRevert();
        registry.transferCompanyOwnership(id, bob);
    }

    // =========================================================================
    // Members
    // =========================================================================

    function test_addAgent_success() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        identity.setOwner(42, alice);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit CompanyRegistry.AgentAdded(id, 42);
        registry.addAgent(id, 42);

        assertTrue(registry.hasMember(id, 42));
        assertEq(registry.memberCount(id), 1);
        uint256[] memory list = registry.members(id);
        assertEq(list.length, 1);
        assertEq(list[0], 42);
    }

    function test_addAgent_reverts_when_caller_not_agent_owner() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        // Agent is owned by bob, but alice is trying to add it to her company.
        identity.setOwner(42, bob);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CompanyRegistry.NotAgentOwner.selector, 42, alice)
        );
        registry.addAgent(id, 42);
    }

    function test_addAgent_reverts_for_non_company_owner() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");
        identity.setOwner(42, bob);

        vm.prank(bob);
        vm.expectRevert();
        registry.addAgent(id, 42);
    }

    function test_addAgent_reverts_on_duplicate() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");
        identity.setOwner(42, alice);

        vm.prank(alice);
        registry.addAgent(id, 42);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CompanyRegistry.AgentAlreadyMember.selector, id, 42)
        );
        registry.addAgent(id, 42);
    }

    function test_removeAgent_success() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");
        identity.setOwner(42, alice);
        identity.setOwner(43, alice);

        vm.prank(alice);
        registry.addAgent(id, 42);
        vm.prank(alice);
        registry.addAgent(id, 43);
        assertEq(registry.memberCount(id), 2);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit CompanyRegistry.AgentRemoved(id, 42);
        registry.removeAgent(id, 42);

        assertFalse(registry.hasMember(id, 42));
        assertTrue(registry.hasMember(id, 43));
        assertEq(registry.memberCount(id), 1);
    }

    function test_removeAgent_reverts_when_not_member() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CompanyRegistry.AgentNotMember.selector, id, 42)
        );
        registry.removeAgent(id, 42);
    }

    // =========================================================================
    // Treasuries
    // =========================================================================

    function test_addTreasury_success() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit CompanyRegistry.TreasuryAdded(id, treasury1);
        registry.addTreasury(id, treasury1);

        assertTrue(registry.hasTreasury(id, treasury1));
        assertEq(registry.treasuryCount(id), 1);
    }

    function test_addTreasury_reverts_on_zero_address() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        vm.expectRevert(CompanyRegistry.ZeroAddress.selector);
        registry.addTreasury(id, address(0));
    }

    function test_addTreasury_reverts_on_duplicate() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        registry.addTreasury(id, treasury1);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                CompanyRegistry.TreasuryAlreadyAdded.selector, id, treasury1
            )
        );
        registry.addTreasury(id, treasury1);
    }

    function test_removeTreasury_success() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        registry.addTreasury(id, treasury1);
        vm.prank(alice);
        registry.addTreasury(id, treasury2);
        assertEq(registry.treasuryCount(id), 2);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit CompanyRegistry.TreasuryRemoved(id, treasury1);
        registry.removeTreasury(id, treasury1);

        assertFalse(registry.hasTreasury(id, treasury1));
        assertTrue(registry.hasTreasury(id, treasury2));
        assertEq(registry.treasuryCount(id), 1);

        address[] memory list = registry.treasuries(id);
        assertEq(list.length, 1);
        assertEq(list[0], treasury2);
    }

    function test_removeTreasury_reverts_when_not_present() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                CompanyRegistry.TreasuryNotFound.selector, id, treasury1
            )
        );
        registry.removeTreasury(id, treasury1);
    }

    // =========================================================================
    // Composite
    // =========================================================================

    function test_multiple_companies_independent() public {
        vm.prank(alice);
        uint256 a = registry.createCompany("ipfs://a");
        vm.prank(bob);
        uint256 b = registry.createCompany("ipfs://b");

        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(registry.companyOwner(a), alice);
        assertEq(registry.companyOwner(b), bob);

        identity.setOwner(100, alice);
        identity.setOwner(200, bob);

        vm.prank(alice);
        registry.addAgent(a, 100);
        vm.prank(bob);
        registry.addAgent(b, 200);

        assertTrue(registry.hasMember(a, 100));
        assertFalse(registry.hasMember(a, 200));
        assertTrue(registry.hasMember(b, 200));
        assertFalse(registry.hasMember(b, 100));
    }

    function test_transfer_then_new_owner_can_manage() public {
        vm.prank(alice);
        uint256 id = registry.createCompany("ipfs://meta");

        vm.prank(alice);
        registry.transferCompanyOwnership(id, bob);

        identity.setOwner(1, bob);
        vm.prank(bob);
        registry.addAgent(id, 1);

        // Alice can no longer manage
        identity.setOwner(2, alice);
        vm.prank(alice);
        vm.expectRevert();
        registry.addAgent(id, 2);
    }
}
