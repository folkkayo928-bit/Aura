// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AuraOwnership} from "../AuraOwnership.sol";

contract DeployAuraOwnership is Script {
    function run() external returns (AuraOwnership deployed) {
        uint256 pk = vm.envUint("AURA_DEPLOYER_PRIVATE_KEY");
        address admin = vm.envAddress("AURA_CONTRACT_ADMIN");
        string memory baseUri = vm.envString("AURA_NFT_BASE_URI");
        address receiver = vm.envAddress("AURA_ROYALTY_RECEIVER");
        uint96 bps = uint96(vm.envUint("AURA_ROYALTY_BPS"));
        vm.startBroadcast(pk);
        deployed = new AuraOwnership(admin, baseUri, receiver, bps);
        vm.stopBroadcast();
    }
}
