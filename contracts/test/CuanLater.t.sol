// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CuanLater} from "../src/CuanLater.sol";
import {MockStock} from "../src/MockStock.sol";
import {MockUSD} from "../src/MockUSD.sol";

contract CuanLaterTest is Test {
    uint256 constant SAT = 1792843200; // Sat 24 Oct 2026 12:00 UTC
    uint256 constant MON = 1793016000; // Mon 26 Oct 2026 12:00 UTC

    MockStock stock;
    MockUSD usd;
    CuanLater cl;

    address treasury = makeAddr("treasury");
    address operator = makeAddr("operator");
    address shop = makeAddr("shop");
    address alice = makeAddr("alice");
    address budi = makeAddr("budi");
    address carol = makeAddr("carol");

    bytes32 constant ID1 = keccak256("id1");
    bytes32 constant ID2 = keccak256("id2");
    bytes32 constant ID3 = keccak256("id3");

    function defaultTape() internal pure returns (uint32[] memory t) {
        uint32[18] memory p = [uint32(40_000000), 40_000000, 40_000000, 40_000000, 40_000000, 40_000000,
            39_800000, 39_500000, 39_200000, 39_500000, 40_000000, 40_600000, 41_200000, 41_800000,
            42_400000, 43_000000, 43_500000, 44_000000];
        t = new uint32[](18);
        for (uint256 i; i < 18; i++) t[i] = p[i];
    }

    function setUp() public {
        vm.warp(SAT);
        stock = new MockStock();
        usd = new MockUSD();
        cl = new CuanLater(IERC20(address(stock)), IERC20(address(usd)), treasury, operator, defaultTape(), 2);
        stock.setMinter(address(cl), true);
        usd.setMinter(address(cl), true);
        usd.setTrustedSpender(address(cl));
        usd.mint(address(cl), 10_000e6);
        cl.registerShop(shop, "Kantin Blitz");
    }

    function setPrice(uint256 p) internal {
        uint32[] memory t = new uint32[](1);
        t[0] = uint32(p);
        cl.setTape(t, 1);
    }

    function joinAs(address u) internal {
        vm.prank(u);
        cl.join();
    }

    function payAs(address u, uint256 amount, CuanLater.Rail rail, bytes32 id)
        internal returns (bool ok, CuanLater.Reason r)
    {
        vm.prank(u);
        return cl.tryPay(shop, amount, rail, id);
    }

    function debtOf(address u) internal view returns (uint256 d) {
        (, d,,,,,,,,,) = cl.accounts(u);
    }

    function sharesOf(address u) internal view returns (uint256 s) {
        (s,,,,,,,,,,) = cl.accounts(u);
    }

    function principalOf(address u) internal view returns (uint256 p) {
        (,, p,,,,,,,,) = cl.accounts(u);
    }

    /// Alice after the demo: coffee by card ($3.00) + es teh by QRIS ($0.50) on a Saturday.
    function demoDebt() internal {
        joinAs(alice);
        payAs(alice, 3_000000, CuanLater.Rail.CARD, ID1);
        payAs(alice, 500000, CuanLater.Rail.QRIS, ID2);
    }

    // T1
    function test_T1_join() public {
        vm.expectEmit(true, false, false, true);
        emit CuanLater.Joined(alice, 1e18, 40_000000, 40_000000);
        joinAs(alice);
        (uint256 shares,, uint256 principal, uint256 entry,,,,, bool joined, bool autoRepay,) = cl.accounts(alice);
        assertEq(shares, 1e18);
        assertEq(principal, 40_000000);
        assertEq(entry, 40_000000);
        assertTrue(joined);
        assertTrue(autoRepay);
        assertEq(stock.balanceOf(address(cl)), 1e18);
        assertEq(cl.membersLength(), 1);
        vm.expectRevert(CuanLater.AlreadyJoined.selector);
        joinAs(alice);
    }

    // T2
    function test_T2_coffeeByCard() public {
        joinAs(alice);
        vm.expectEmit(true, true, true, true);
        emit CuanLater.Paid(alice, shop, 3_000000, 15000, 3_015000, CuanLater.Rail.CARD, ID1);
        (bool ok, CuanLater.Reason r) = payAs(alice, 3_000000, CuanLater.Rail.CARD, ID1);
        assertTrue(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.NONE));
        assertEq(debtOf(alice), 3_015000);
        assertEq(usd.balanceOf(shop), 3_000000);
        assertEq(sharesOf(alice), 1e18);
        assertEq(cl.availableOf(alice), 6_985000);
    }

    // T3
    function test_T3_esTehByQris() public {
        demoDebt();
        assertEq(debtOf(alice), 3_517500);
        assertEq(cl.availableOf(alice), 6_482500);
        assertEq(usd.balanceOf(shop), 3_500000);
    }

    // T4
    function test_T4_weekendLimit() public {
        demoDebt();
        vm.expectEmit(true, true, true, true);
        emit CuanLater.Declined(alice, shop, 10_000000, CuanLater.Rail.CARD, ID3,
            CuanLater.Reason.OVER_WEEKEND_LIMIT, 13_567500, 10_000000);
        (bool ok, CuanLater.Reason r) = payAs(alice, 10_000000, CuanLater.Rail.CARD, ID3);
        assertFalse(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.OVER_WEEKEND_LIMIT));
        assertEq(debtOf(alice), 3_517500);
        assertEq(usd.balanceOf(shop), 3_500000);
    }

    // T5
    function test_T5_weekdayLimit() public {
        vm.warp(MON);
        joinAs(carol);
        (bool ok, CuanLater.Reason r) = payAs(carol, 14_000000, CuanLater.Rail.CARD, ID1);
        assertFalse(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.OVER_WEEKDAY_LIMIT));
        (ok,) = payAs(carol, 13_000000, CuanLater.Rail.CARD, ID2);
        assertTrue(ok);
    }

    // T6
    function test_T6_payReverts() public {
        demoDebt();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CuanLater.OverWeekendLimit.selector, 13_567500, 10_000000));
        cl.pay(shop, 10_000000, CuanLater.Rail.CARD, ID3);
    }

    // T7
    function test_T7_freeze() public {
        vm.warp(MON);
        joinAs(alice);
        vm.prank(alice);
        cl.freeze();
        (bool ok, CuanLater.Reason r) = payAs(alice, 5_000000, CuanLater.Rail.CARD, ID1);
        assertFalse(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.FROZEN));
        assertEq(debtOf(alice), 0);
        vm.prank(alice);
        cl.unfreeze();
        (ok,) = payAs(alice, 5_000000, CuanLater.Rail.CARD, ID2);
        assertTrue(ok);
    }

    // T8
    function test_T8_unknownShop() public {
        joinAs(alice);
        vm.prank(alice);
        (bool ok, CuanLater.Reason r) = cl.tryPay(makeAddr("random"), 1_000000, CuanLater.Rail.CARD, ID1);
        assertFalse(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.UNKNOWN_SHOP));
    }

    // T9
    function test_T9_notJoined() public {
        (bool ok, CuanLater.Reason r) = payAs(budi, 1_000000, CuanLater.Rail.CARD, ID1);
        assertFalse(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.NOT_JOINED));
    }

    // T10
    function test_T10_poolEmpty() public {
        joinAs(alice);
        uint256 pool = usd.balanceOf(address(cl));
        vm.prank(address(cl));
        usd.transfer(treasury, pool);
        (bool ok, CuanLater.Reason r) = payAs(alice, 1_000000, CuanLater.Rail.CARD, ID1);
        assertFalse(ok);
        assertEq(uint8(r), uint8(CuanLater.Reason.POOL_EMPTY));
    }

    // T11
    function test_T11_tape() public {
        assertEq(cl.price(), 40_000000);
        uint256 start = block.number;
        cl.startTape();
        vm.roll(start + 16); // index 8 = bottom of the dip
        assertEq(cl.price(), 39_200000);
        vm.expectRevert(CuanLater.TapeRunning.selector);
        cl.startTape();
        vm.roll(start + 36);
        assertEq(cl.price(), 44_000000);
        vm.roll(start + 100);
        assertEq(cl.price(), 44_000000);
        cl.resetTape();
        assertEq(cl.price(), 40_000000);
    }

    // T12
    function test_T12_cashRepay() public {
        demoDebt();
        vm.prank(alice);
        cl.topUp();
        assertEq(usd.balanceOf(alice), 10_000000);
        vm.expectEmit(true, false, false, true);
        emit CuanLater.Repaid(alice, 3_517500, 0, CuanLater.Source.CASH);
        vm.prank(alice);
        cl.repay(3_517500);
        assertEq(debtOf(alice), 0);
        assertEq(usd.balanceOf(alice), 6_482500);
    }

    // T13
    function test_T13_profitPays() public {
        demoDebt();
        setPrice(44_000000);
        uint256 sold = 79943181818181819;
        vm.expectEmit(true, false, false, true);
        emit CuanLater.ProfitRepaid(alice, 3_517500, sold, 44_000000, 0);
        address[] memory users = new address[](1);
        users[0] = alice;
        cl.harvestMany(users);
        assertEq(debtOf(alice), 0);
        assertEq(sharesOf(alice), 920056818181818181);
        assertEq(principalOf(alice), 40_000000);
        assertEq(stock.balanceOf(treasury), sold);
        assertGe(cl.valueOf(alice), 40_000000); // starting value untouched: $40.48
        assertEq(cl.valueOf(alice), 40_482499); // shown as $40.48
    }

    // T14
    function test_T14_onlyProfit() public {
        demoDebt();
        setPrice(41_000000);
        address[] memory users = new address[](1);
        users[0] = alice;
        cl.harvestMany(users);
        assertEq(debtOf(alice), 2_517500);
        assertApproxEqAbs(cl.valueOf(alice), 40_000000, 1);
    }

    // T15
    function test_T15_autoRepayOff() public {
        demoDebt();
        vm.prank(alice);
        cl.setAutoRepay(false);
        setPrice(44_000000);
        cl.harvestRange(0, 50);
        assertEq(debtOf(alice), 3_517500);
        assertEq(sharesOf(alice), 1e18);
    }

    // T16
    function test_T16_noProfit() public {
        demoDebt();
        setPrice(40_000000);
        cl.harvestRange(0, 50);
        assertEq(debtOf(alice), 3_517500);
        setPrice(39_000000);
        cl.harvestRange(0, 50);
        assertEq(debtOf(alice), 3_517500);
        assertEq(sharesOf(alice), 1e18);
    }

    // T17: three members, only alice harvestable
    function test_T17_harvestRange() public {
        demoDebt();
        joinAs(budi);
        joinAs(carol);
        vm.prank(carol);
        cl.setAutoRepay(false);
        payAs(carol, 1_000000, CuanLater.Rail.CARD, ID3);
        setPrice(44_000000);
        vm.recordLogs();
        cl.harvestRange(0, cl.membersLength());
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 n;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter == address(cl) && logs[i].topics[0] == CuanLater.ProfitRepaid.selector) n++;
        }
        assertEq(n, 1);
        assertEq(debtOf(alice), 0);
        assertEq(debtOf(carol), 1_005000);
        assertEq(sharesOf(budi), 1e18);
        assertEq(sharesOf(carol), 1e18);
    }

    // T18
    function test_T18_repayWithStock() public {
        demoDebt();
        vm.prank(alice);
        cl.repayWithStock();
        uint256 sold = 87937500000000000;
        assertEq(debtOf(alice), 0);
        assertEq(sharesOf(alice), 1e18 - sold);
        assertEq(principalOf(alice), 40_000000 - 40_000000 * sold / 1e18);
        assertEq(principalOf(alice), 36_482500);
        assertEq(stock.balanceOf(treasury), sold);
    }

    function budiAt10() internal {
        vm.warp(MON);
        joinAs(budi);
        payAs(budi, 10_000000, CuanLater.Rail.CARD, ID1);
        assertEq(debtOf(budi), 10_050000);
    }

    // T19
    function test_T19_safetySell() public {
        budiAt10();
        setPrice(20_000000);
        assertEq(cl.health(budi), 5025);
        cl.liquidate(budi);
        assertEq(debtOf(budi), 10_050000 - 4_692308);
        assertEq(sharesOf(budi), 1e18 - 234615400000000000);
        assertApproxEqAbs(cl.health(budi), 3500, 1);
    }

    // T20
    function test_T20_notLiquidatable() public {
        budiAt10();
        setPrice(22_000000);
        vm.expectRevert(abi.encodeWithSelector(CuanLater.NotLiquidatable.selector, 4568));
        cl.liquidate(budi);
    }

    // T21
    function test_T21_dailyLimit() public {
        vm.warp(MON);
        joinAs(alice);
        vm.prank(alice);
        cl.setDailyLimit(5_000000);
        (bool ok,) = payAs(alice, 3_000000, CuanLater.Rail.CARD, ID1);
        assertTrue(ok);
        (bool ok2, CuanLater.Reason r) = payAs(alice, 3_000000, CuanLater.Rail.CARD, ID2);
        assertFalse(ok2);
        assertEq(uint8(r), uint8(CuanLater.Reason.OVER_DAILY_LIMIT));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CuanLater.OverDailyLimit.selector, 3_000000, 2_000000));
        cl.pay(shop, 3_000000, CuanLater.Rail.CARD, ID2);
        vm.warp(MON + 1 days);
        (ok,) = payAs(alice, 3_000000, CuanLater.Rail.CARD, ID3);
        assertTrue(ok);
    }

    // T22
    function test_T22_tapLimit() public {
        joinAs(alice);
        vm.prank(shop);
        (bool ok0, CuanLater.Reason r0) = cl.charge(alice, 3_000000, CuanLater.Rail.CARD, ID1);
        assertFalse(ok0); // tap limit off by default
        assertEq(uint8(r0), uint8(CuanLater.Reason.OVER_TAP_LIMIT));
        vm.prank(alice);
        cl.setTapLimit(5_000000);
        vm.prank(shop);
        (bool ok,) = cl.charge(alice, 3_000000, CuanLater.Rail.CARD, ID1);
        assertTrue(ok);
        vm.prank(shop);
        (bool ok2, CuanLater.Reason r) = cl.charge(alice, 6_000000, CuanLater.Rail.CARD, ID2);
        assertFalse(ok2);
        assertEq(uint8(r), uint8(CuanLater.Reason.OVER_TAP_LIMIT));
        vm.prank(budi);
        vm.expectRevert(CuanLater.UnknownShop.selector);
        cl.charge(alice, 1_000000, CuanLater.Rail.CARD, ID3);
    }

    // T23
    function test_T23_repayFor() public {
        demoDebt();
        usd.mint(operator, 5_000000);
        vm.expectEmit(true, false, false, true);
        emit CuanLater.Repaid(alice, 1_000000, 2_517500, CuanLater.Source.OPERATOR);
        vm.prank(operator);
        cl.repayFor(alice, 1_000000);
        assertEq(debtOf(alice), 2_517500);
        assertEq(usd.balanceOf(operator), 4_000000);
        vm.prank(alice);
        vm.expectRevert(CuanLater.NotOperator.selector);
        cl.repayFor(alice, 1_000000);
    }

    // T24
    function test_T24_withdraw() public {
        demoDebt();
        vm.prank(alice);
        vm.expectRevert(CuanLater.DebtOutstanding.selector);
        cl.withdraw(1e18);
        vm.prank(alice);
        cl.topUp();
        vm.prank(alice);
        cl.repay(type(uint256).max);
        vm.prank(alice);
        cl.withdraw(1e18);
        assertEq(stock.balanceOf(alice), 1e18);
        assertEq(sharesOf(alice), 0);
        assertEq(principalOf(alice), 0);
    }

    // T25
    function test_T25_weekendMath() public {
        uint256 day0 = 1792800000; // Sat 24 Oct 2026 00:00 UTC
        for (uint256 i; i < 7; i++) {
            vm.warp(day0 + i * 1 days + 12 hours);
            assertEq(cl.isWeekend(), i == 0 || i == 1, "only Sat 24 and Sun 25");
            vm.warp(day0 + i * 1 days);
            assertEq(cl.isWeekend(), i == 0 || i == 1);
            vm.warp(day0 + (i + 1) * 1 days - 1);
            assertEq(cl.isWeekend(), i == 0 || i == 1);
        }
    }

    // T26
    function testFuzz_T26_debtAccounting(uint256[5] memory amounts, uint256 repayAmt) public {
        vm.warp(MON);
        joinAs(alice);
        joinAs(budi);
        uint256 expected;
        for (uint256 i; i < amounts.length; i++) {
            uint256 left = cl.availableOf(alice);
            if (left < 2) break;
            uint256 a = bound(amounts[i], 1, left * 10_000 / 10_050);
            (bool ok,) = payAs(alice, a, CuanLater.Rail.CARD, bytes32(i));
            assertTrue(ok);
            expected += a + a * 50 / 10_000;
        }
        assertEq(debtOf(alice), expected);
        vm.prank(alice);
        cl.topUp();
        repayAmt = bound(repayAmt, 0, 10_000000);
        vm.prank(alice);
        cl.repay(repayAmt);
        expected -= repayAmt < expected ? repayAmt : expected;
        assertEq(debtOf(alice), expected);
        assertEq(stock.balanceOf(address(cl)), sharesOf(alice) + sharesOf(budi));
        if (expected > 0) {
            vm.prank(alice);
            cl.repayWithStock();
        }
        assertEq(stock.balanceOf(address(cl)), sharesOf(alice) + sharesOf(budi));
    }

    function test_resetAccount() public {
        demoDebt();
        cl.resetAccount(alice);
        assertEq(debtOf(alice), 0);
        assertEq(stock.balanceOf(treasury), 1e18);
        joinAs(alice);
        assertEq(sharesOf(alice), 1e18);
        vm.prank(alice);
        vm.expectRevert();
        cl.resetAccount(alice);
    }

    function test_mockUsdNoApproveForTrustedSpender() public view {
        assertEq(usd.allowance(alice, address(cl)), type(uint256).max);
        assertEq(usd.allowance(alice, budi), 0);
    }
}

