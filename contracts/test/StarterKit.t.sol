// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StarterKit} from "../src/StarterKit.sol";
import {TestMUSD} from "./utils/Doubles.sol";

contract StarterKitTest is Test {
    TestMUSD musd;
    StarterKit kit;
    address owner = makeAddr("owner");
    address relayer = makeAddr("relayer");
    address visitor = makeAddr("visitor");

    function setUp() public {
        musd = new TestMUSD();
        kit = new StarterKit(owner, IERC20(address(musd)), 20e18, 0.00001 ether, relayer);
        musd.mint(address(kit), 100e18);
        vm.deal(address(kit), 0.0001 ether);
    }

    function test_sendsKitOncePerAddress() public {
        vm.prank(relayer);
        kit.send(visitor);
        assertEq(musd.balanceOf(visitor), 20e18);
        assertEq(visitor.balance, 0.00001 ether);
        assertTrue(kit.claimed(visitor));
        assertEq(kit.kitsGiven(), 1);

        vm.prank(relayer);
        vm.expectRevert(StarterKit.AlreadyClaimed.selector);
        kit.send(visitor);
    }

    function test_onlyRelayer() public {
        vm.prank(visitor);
        vm.expectRevert(StarterKit.NotRelayer.selector);
        kit.send(visitor);
    }

    function test_kitsLeftAndEmpty() public {
        assertEq(kit.kitsLeft(), 5);
        for (uint256 i; i < 5; i++) {
            vm.prank(relayer);
            kit.send(makeAddr(string.concat("v", vm.toString(i))));
        }
        assertEq(kit.kitsLeft(), 0);
        vm.prank(relayer);
        vm.expectRevert(StarterKit.Empty.selector);
        kit.send(visitor);
    }

    function test_ownerSweepsAndSetsRelayer() public {
        vm.prank(visitor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, visitor));
        kit.sweep(visitor);
        vm.startPrank(owner);
        kit.setRelayer(visitor);
        kit.sweep(owner);
        vm.stopPrank();
        assertEq(musd.balanceOf(owner), 100e18);
        assertEq(owner.balance, 0.0001 ether);
        assertEq(kit.relayer(), visitor);
    }
}
