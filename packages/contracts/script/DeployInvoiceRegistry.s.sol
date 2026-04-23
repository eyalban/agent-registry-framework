// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

contract DeployInvoiceRegistry is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        InvoiceRegistry inv = new InvoiceRegistry();
        console.log("InvoiceRegistry deployed at:", address(inv));
        vm.stopBroadcast();
    }
}
