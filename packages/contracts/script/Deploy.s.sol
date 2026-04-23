// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistryWrapper} from "../src/AgentRegistryWrapper.sol";

/**
 * @title Deploy
 * @notice Deployment script for AgentRegistryWrapper on Base Sepolia.
 * @dev Run with:
 *      forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
 */
contract Deploy is Script {
    // Canonical ERC-8004 Identity Registry on Base Sepolia
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    // Initial registration fee: 0.001 ETH
    uint256 constant INITIAL_FEE = 0.001 ether;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        AgentRegistryWrapper wrapper = new AgentRegistryWrapper(
            IDENTITY_REGISTRY,
            INITIAL_FEE
        );

        console.log("AgentRegistryWrapper deployed at:", address(wrapper));
        console.log("Identity Registry:", IDENTITY_REGISTRY);
        console.log("Registration fee:", INITIAL_FEE);

        vm.stopBroadcast();
    }
}
