// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AuraOwnership} from "../AuraOwnership.sol";

contract AuraOwnershipTest is Test {
    AuraOwnership nft;
    address admin = address(0xA11CE);
    address alice = address(0xB0B);
    address bob = address(0xC0DE);

    function setUp() public { nft = new AuraOwnership(admin, "ipfs://aura/", admin, 500); }
    function testOnlyMinterCanMint() public {
        vm.prank(admin);
        uint256 id = nft.mint(alice, "ipfs://item-1");
        assertEq(id, 1);
        assertEq(nft.ownerOf(id), alice);
        vm.expectRevert();
        vm.prank(bob);
        nft.mint(bob, "ipfs://item-2");
    }
    function testPauseBlocksMint() public {
        vm.prank(admin);
        nft.pause();
        vm.expectRevert();
        nft.mint(alice, "ipfs://item-1");
    }
}
