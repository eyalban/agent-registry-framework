// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CompanyRegistry} from "../src/CompanyRegistry.sol";

/**
 * @title DeployCompanyRegistry
 * @notice Deploys CompanyRegistry on Base Sepolia (or Base mainnet).
 * @dev Run with:
 *      forge script script/DeployCompanyRegistry.s.sol --rpc-url base_sepolia --broadcast --verify
 */
contract DeployCompanyRegistry is Script {
    // Canonical ERC-8004 Identity Registry (same on Sepolia + mainnet).
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CompanyRegistry companyRegistry = new CompanyRegistry(IDENTITY_REGISTRY);

        console.log("CompanyRegistry deployed at:", address(companyRegistry));
        console.log("Identity Registry:", IDENTITY_REGISTRY);

        vm.stopBroadcast();
    }
}
