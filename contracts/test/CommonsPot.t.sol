// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";
import {CommonsPot} from "../src/CommonsPot.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockStable is ERC20 {
    constructor() ERC20("Mock Stable", "mUSD", 18) {}

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

contract CommonsPotTest is Test {
    MockStable stable;
    CommonsPot pot;
    address safe = address(0x5AFE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address feeSrc = address(0xFEE);

    function setUp() public {
        stable = new MockStable();
        pot = new CommonsPot(IERC20(address(stable)), safe);
        vm.prank(safe);
        pot.setFeeSource(feeSrc, true);
        stable.mint(alice, 1_000e18);
        stable.mint(bob, 1_000e18);
        stable.mint(feeSrc, 1_000e18);
    }

    function testDepositExit() public {
        vm.startPrank(alice);
        stable.approve(address(pot), 100e18);
        pot.deposit(100e18, alice);
        vm.stopPrank();
        assertEq(pot.balanceOf(alice), 100e18);

        vm.prank(alice);
        pot.redeem(100e18, alice, alice);
        assertEq(stable.balanceOf(alice), 1_000e18);
        assertEq(pot.balanceOf(alice), 0);
    }

    function testSkimGrowsShares() public {
        vm.startPrank(alice);
        stable.approve(address(pot), 100e18);
        pot.deposit(100e18, alice);
        vm.stopPrank();

        vm.startPrank(feeSrc);
        stable.approve(address(pot), 100e18);
        pot.skim(100e18);
        vm.stopPrank();

        // alice's 100 shares now claim 200 assets
        assertEq(pot.convertToAssets(100e18), 200e18);
    }

    function testSkimRevertsForNonSource() public {
        vm.prank(bob);
        vm.expectRevert("not a fee source");
        pot.skim(1e18);
    }

    function testPauseBlocksExit() public {
        vm.startPrank(alice);
        stable.approve(address(pot), 10e18);
        pot.deposit(10e18, alice);
        vm.stopPrank();
        vm.prank(safe);
        pot.pause();
        vm.prank(alice);
        vm.expectRevert();
        pot.redeem(10e18, alice, alice);
    }

    function testFuzzDepositRedeem(uint128 amt) public {
        vm.assume(amt > 0 && amt <= 1_000e18);
        vm.startPrank(alice);
        stable.approve(address(pot), amt);
        pot.deposit(amt, alice);
        pot.redeem(pot.balanceOf(alice), alice, alice);
        vm.stopPrank();
        assertEq(stable.balanceOf(alice), 1_000e18);
        assertEq(pot.totalSupply(), 0);
    }
}
