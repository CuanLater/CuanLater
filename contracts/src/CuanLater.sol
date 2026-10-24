// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {MockStock} from "./MockStock.sol";
import {MockUSD} from "./MockUSD.sol";

/// @title CuanLater vault: pay with Cuan Card by borrowing against locked tNVDA; profit pays the debt.
contract CuanLater is Ownable, ReentrancyGuard {
    enum Rail { CARD, QRIS }
    enum Reason { NONE, NOT_JOINED, UNKNOWN_SHOP, FROZEN, ZERO_AMOUNT,
                  OVER_WEEKEND_LIMIT, OVER_WEEKDAY_LIMIT, OVER_DAILY_LIMIT,
                  OVER_TAP_LIMIT, POOL_EMPTY }
    enum Source { CASH, STOCK, OPERATOR }

    struct Account {
        uint256 shares;      // locked tNVDA (18 dec)
        uint256 debt;        // tUSD owed (6 dec)
        uint256 principal;   // USD value at join (6 dec); profit = value - principal
        uint256 entryPrice;  // price at join, for display only
        uint256 dailyLimit;  // 0 = off
        uint256 spentToday;  // payments today, excluding fees
        uint256 dayIndex;    // block.timestamp / 1 days of spentToday
        uint256 tapLimit;    // 0 = off (R16)
        bool    joined;
        bool    autoRepay;   // Bayar pakai cuan, default true
        bool    frozen;
    }

    struct AccountView {
        uint256 shares;
        uint256 debt;
        uint256 principal;
        uint256 entryPrice;
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 dayIndex;
        uint256 tapLimit;
        bool    joined;
        bool    autoRepay;
        bool    frozen;
        uint256 value;
        uint256 limit;
        uint256 available;
        uint256 health;
        uint256 price;
        bool    isWeekend;
        uint256 limitBps;
        uint256 spentTodayNow;
    }

    uint256 public constant SHARES_PER_JOIN = 1e18;
    uint256 public constant FEE_BPS = 50;
    uint256 public constant WEEKDAY_LIMIT_BPS = 3500;
    uint256 public constant WEEKEND_LIMIT_BPS = 2500;
    uint256 public constant LIQUIDATION_BPS = 5000;
    uint256 public constant TARGET_BPS = 3500;
    uint256 public constant TOP_UP = 10e6;
    uint256 private constant BPS = 10_000;

    IERC20  public immutable stock;
    IERC20  public immutable usd;
    address public treasury;
    address public operator;
    mapping(address => Account) public accounts;
    address[] public members;
    mapping(address => string) public shopName;
    uint32[] public tape;
    uint256 public tapeStart;
    uint256 public tapeStep;

    event Joined(address indexed user, uint256 shares, uint256 entryPrice, uint256 principal);
    event Paid(address indexed user, address indexed shop, uint256 amount, uint256 fee, uint256 debtAfter, Rail rail, bytes32 indexed orderId);
    event Declined(address indexed user, address indexed shop, uint256 amount, Rail rail, bytes32 indexed orderId, Reason reason, uint256 a, uint256 b);
    event ProfitRepaid(address indexed user, uint256 paid, uint256 sharesSold, uint256 price, uint256 debtAfter);
    event Repaid(address indexed user, uint256 amount, uint256 debtAfter, Source source);
    event Liquidated(address indexed user, uint256 usdSold, uint256 sharesSold, uint256 price, uint256 healthAfterBps);
    event Withdrawn(address indexed user, uint256 shares);
    event Frozen(address indexed user);
    event Unfrozen(address indexed user);
    event AutoRepaySet(address indexed user, bool on);
    event DailyLimitSet(address indexed user, uint256 amount);
    event TapLimitSet(address indexed user, uint256 amount);
    event TapeStarted(uint256 startBlock, uint256 step);
    event ShopRegistered(address indexed shop, string name);

    error NotJoined();
    error AlreadyJoined();
    error UnknownShop();
    error CardFrozen();
    error ZeroAmount();
    error OverWeekendLimit(uint256 wouldOwe, uint256 limit);
    error OverWeekdayLimit(uint256 wouldOwe, uint256 limit);
    error OverDailyLimit(uint256 asked, uint256 left);
    error OverTapLimit(uint256 asked, uint256 tapLimit);
    error PoolEmpty();
    error NotLiquidatable(uint256 healthBps);
    error DebtOutstanding();
    error NotOperator();
    error TapeRunning();
    error NotEnoughShares();
    error EmptyTape();

    constructor(IERC20 stock_, IERC20 usd_, address treasury_, address operator_, uint32[] memory tape_, uint256 tapeStep_)
        Ownable(msg.sender)
    {
        stock = stock_;
        usd = usd_;
        treasury = treasury_;
        operator = operator_;
        _setTape(tape_, tapeStep_);
    }

    // ───────────── price tape ─────────────

    function price() public view returns (uint256) {
        if (tapeStart == 0) return tape[0];
        uint256 i = (block.number - tapeStart) / tapeStep;
        return i < tape.length ? tape[i] : tape[tape.length - 1];
    }

    function startTape() external {
        if (tapeStart != 0 && block.number < tapeStart + tape.length * tapeStep) revert TapeRunning();
        tapeStart = block.number;
        emit TapeStarted(block.number, tapeStep);
    }

    function resetTape() external onlyOwner {
        tapeStart = 0;
    }

    function setTape(uint32[] calldata points, uint256 step) external onlyOwner {
        _setTape(points, step);
    }

    function tapeLength() external view returns (uint256) {
        return tape.length;
    }

    function tapePoints() external view returns (uint32[] memory) {
        return tape;
    }

    function _setTape(uint32[] memory points, uint256 step) internal {
        if (points.length == 0 || step == 0) revert EmptyTape();
        tape = points;
        tapeStep = step;
        tapeStart = 0;
    }

    // ───────────── joining and card controls ─────────────

    function join() external nonReentrant {
        Account storage a = accounts[msg.sender];
        if (a.joined) revert AlreadyJoined();
        uint256 p = price();
        a.joined = true;
        a.autoRepay = true;
        a.shares = SHARES_PER_JOIN;
        a.entryPrice = p;
        a.principal = _value(SHARES_PER_JOIN, p);
        members.push(msg.sender);
        MockStock(address(stock)).mint(address(this), SHARES_PER_JOIN);
        emit Joined(msg.sender, SHARES_PER_JOIN, p, a.principal);
    }

    function setAutoRepay(bool on) external {
        accounts[msg.sender].autoRepay = on;
        emit AutoRepaySet(msg.sender, on);
    }

    function freeze() external {
        accounts[msg.sender].frozen = true;
        emit Frozen(msg.sender);
    }

    function unfreeze() external {
        accounts[msg.sender].frozen = false;
        emit Unfrozen(msg.sender);
    }

    function setDailyLimit(uint256 amount) external {
        accounts[msg.sender].dailyLimit = amount;
        emit DailyLimitSet(msg.sender, amount);
    }

    function setTapLimit(uint256 amount) external {
        accounts[msg.sender].tapLimit = amount;
        emit TapLimitSet(msg.sender, amount);
    }

    /// "Pretend salary": mints $10 tUSD to a joined user.
    function topUp() external nonReentrant {
        if (!accounts[msg.sender].joined) revert NotJoined();
        MockUSD(address(usd)).mint(msg.sender, TOP_UP);
    }

    // ───────────── paying ─────────────

    function tryPay(address shop, uint256 amount, Rail rail, bytes32 orderId)
        external nonReentrant returns (bool ok, Reason reason)
    {
        return _tryPay(msg.sender, shop, amount, rail, orderId, false);
    }

    function pay(address shop, uint256 amount, Rail rail, bytes32 orderId) external nonReentrant {
        (Reason r, uint256 x, uint256 y) = _check(msg.sender, shop, amount, false);
        if (r == Reason.NOT_JOINED) revert NotJoined();
        if (r == Reason.UNKNOWN_SHOP) revert UnknownShop();
        if (r == Reason.FROZEN) revert CardFrozen();
        if (r == Reason.ZERO_AMOUNT) revert ZeroAmount();
        if (r == Reason.OVER_WEEKEND_LIMIT) revert OverWeekendLimit(x, y);
        if (r == Reason.OVER_WEEKDAY_LIMIT) revert OverWeekdayLimit(x, y);
        if (r == Reason.OVER_DAILY_LIMIT) revert OverDailyLimit(amount, y > x - amount ? y - (x - amount) : 0);
        if (r == Reason.POOL_EMPTY) revert PoolEmpty();
        _settle(msg.sender, shop, amount, rail, orderId);
    }

    /// Shop pulls a payment without a phone tap, only up to the user's tap limit (R16).
    function charge(address user, uint256 amount, Rail rail, bytes32 orderId)
        external nonReentrant returns (bool ok, Reason reason)
    {
        if (bytes(shopName[msg.sender]).length == 0) revert UnknownShop();
        return _tryPay(user, msg.sender, amount, rail, orderId, true);
    }

    function _tryPay(address user, address shop, uint256 amount, Rail rail, bytes32 orderId, bool viaCharge)
        internal returns (bool, Reason)
    {
        (Reason r, uint256 x, uint256 y) = _check(user, shop, amount, viaCharge);
        if (r != Reason.NONE) {
            emit Declined(user, shop, amount, rail, orderId, r, x, y);
            return (false, r);
        }
        _settle(user, shop, amount, rail, orderId);
        return (true, Reason.NONE);
    }

    /// Returns the first failing reason plus the two amounts the Declined event carries.
    function _check(address user, address shop, uint256 amount, bool viaCharge)
        internal view returns (Reason, uint256, uint256)
    {
        Account storage a = accounts[user];
        if (!a.joined) return (Reason.NOT_JOINED, 0, 0);
        if (bytes(shopName[shop]).length == 0) return (Reason.UNKNOWN_SHOP, 0, 0);
        if (a.frozen) return (Reason.FROZEN, 0, 0);
        if (amount == 0) return (Reason.ZERO_AMOUNT, 0, 0);
        uint256 wouldOwe = a.debt + amount + _fee(amount);
        uint256 limit = _value(a.shares, price()) * limitBps() / BPS;
        if (wouldOwe > limit) {
            return (isWeekend() ? Reason.OVER_WEEKEND_LIMIT : Reason.OVER_WEEKDAY_LIMIT, wouldOwe, limit);
        }
        uint256 spent = _spentTodayNow(a);
        if (a.dailyLimit > 0 && spent + amount > a.dailyLimit) {
            return (Reason.OVER_DAILY_LIMIT, spent + amount, a.dailyLimit);
        }
        if (viaCharge && (a.tapLimit == 0 || amount > a.tapLimit)) {
            return (Reason.OVER_TAP_LIMIT, amount, a.tapLimit);
        }
        if (usd.balanceOf(address(this)) < amount) return (Reason.POOL_EMPTY, wouldOwe, limit);
        return (Reason.NONE, wouldOwe, limit);
    }

    function _settle(address user, address shop, uint256 amount, Rail rail, bytes32 orderId) internal {
        Account storage a = accounts[user];
        uint256 today = block.timestamp / 1 days;
        if (a.dayIndex != today) {
            a.dayIndex = today;
            a.spentToday = 0;
        }
        uint256 fee = _fee(amount);
        a.spentToday += amount;
        a.debt += amount + fee;
        emit Paid(user, shop, amount, fee, a.debt, rail, orderId);
        require(usd.transfer(shop, amount));
    }

    // ───────────── profit pays (Bayar pakai cuan) ─────────────

    function harvestMany(address[] calldata users) external nonReentrant {
        uint256 p = price();
        for (uint256 i = 0; i < users.length; i++) _harvest(users[i], p);
    }

    function harvestRange(uint256 from, uint256 count) external nonReentrant {
        uint256 p = price();
        uint256 end = Math.min(from + count, members.length);
        for (uint256 i = from; i < end; i++) _harvest(members[i], p);
    }

    function _harvest(address user, uint256 p) internal {
        Account storage a = accounts[user];
        if (!a.autoRepay || a.debt == 0) return;
        uint256 v = _value(a.shares, p);
        if (v <= a.principal) return;
        uint256 paid = Math.min(a.debt, v - a.principal);
        uint256 sold = Math.min(_sharesFor(paid, p), a.shares);
        a.shares -= sold;
        a.debt -= paid;
        // principal is unchanged on purpose: later profit is measured from the same starting value.
        emit ProfitRepaid(user, paid, sold, p, a.debt);
        require(stock.transfer(treasury, sold));
    }

    // ───────────── paying back yourself ─────────────

    function repay(uint256 amount) external nonReentrant {
        _repay(msg.sender, msg.sender, amount, Source.CASH);
    }

    function repayFor(address user, uint256 amount) external nonReentrant {
        if (msg.sender != operator) revert NotOperator();
        _repay(user, msg.sender, amount, Source.OPERATOR);
    }

    function _repay(address user, address from, uint256 amount, Source source) internal {
        Account storage a = accounts[user];
        uint256 amt = Math.min(amount, a.debt);
        a.debt -= amt;
        emit Repaid(user, amt, a.debt, source);
        require(usd.transferFrom(from, address(this), amt));
    }

    function repayWithStock() external nonReentrant {
        Account storage a = accounts[msg.sender];
        uint256 paidUsd = a.debt;
        uint256 sold = _sharesFor(paidUsd, price());
        if (sold > a.shares) revert NotEnoughShares();
        a.principal -= a.principal * sold / a.shares;
        a.shares -= sold;
        a.debt = 0;
        emit Repaid(msg.sender, paidUsd, 0, Source.STOCK);
        require(stock.transfer(treasury, sold));
    }

    function withdraw(uint256 sharesOut) external nonReentrant {
        Account storage a = accounts[msg.sender];
        if (a.debt != 0) revert DebtOutstanding();
        if (sharesOut > a.shares) revert NotEnoughShares();
        if (sharesOut == 0) return;
        a.principal -= a.principal * sharesOut / a.shares;
        a.shares -= sharesOut;
        emit Withdrawn(msg.sender, sharesOut);
        require(stock.transfer(msg.sender, sharesOut));
    }

    // ───────────── safety sell (R11) ─────────────

    function liquidate(address user) external nonReentrant {
        Account storage a = accounts[user];
        uint256 p = price();
        uint256 v = _value(a.shares, p);
        uint256 h = _health(a.debt, v);
        if (a.debt == 0 || h <= LIQUIDATION_BPS) revert NotLiquidatable(h);
        uint256 x;
        uint256 sold;
        if (a.debt >= v) {
            // underwater: sell everything, the rest stays as bad debt
            x = v;
            sold = a.shares;
        } else {
            x = Math.ceilDiv(a.debt * BPS - v * TARGET_BPS, BPS - TARGET_BPS);
            sold = Math.min(_sharesFor(x, p), a.shares);
        }
        a.principal -= a.shares == 0 ? 0 : a.principal * sold / a.shares;
        a.shares -= sold;
        a.debt -= Math.min(x, a.debt);
        uint256 hAfter = _health(a.debt, _value(a.shares, p));
        emit Liquidated(user, x, sold, p, hAfter);
        require(stock.transfer(treasury, sold));
    }

    // ───────────── views ─────────────

    function isWeekend() public view returns (bool) {
        uint256 d = ((block.timestamp / 1 days) + 4) % 7; // 0 = Sun, 6 = Sat (UTC)
        return d == 0 || d == 6;
    }

    function limitBps() public view returns (uint256) {
        return isWeekend() ? WEEKEND_LIMIT_BPS : WEEKDAY_LIMIT_BPS;
    }

    function valueOf(address user) public view returns (uint256) {
        return _value(accounts[user].shares, price());
    }

    function limitOf(address user) public view returns (uint256) {
        return valueOf(user) * limitBps() / BPS;
    }

    function availableOf(address user) public view returns (uint256) {
        uint256 l = limitOf(user);
        uint256 d = accounts[user].debt;
        return l > d ? l - d : 0;
    }

    function health(address user) public view returns (uint256) {
        return _health(accounts[user].debt, valueOf(user));
    }

    function membersLength() external view returns (uint256) {
        return members.length;
    }

    function accountView(address user) external view returns (AccountView memory v) {
        Account storage a = accounts[user];
        v.shares = a.shares;
        v.debt = a.debt;
        v.principal = a.principal;
        v.entryPrice = a.entryPrice;
        v.dailyLimit = a.dailyLimit;
        v.spentToday = a.spentToday;
        v.dayIndex = a.dayIndex;
        v.tapLimit = a.tapLimit;
        v.joined = a.joined;
        v.autoRepay = a.autoRepay;
        v.frozen = a.frozen;
        v.price = price();
        v.isWeekend = isWeekend();
        v.limitBps = limitBps();
        v.value = _value(a.shares, v.price);
        v.limit = v.value * v.limitBps / BPS;
        v.available = v.limit > a.debt ? v.limit - a.debt : 0;
        v.health = _health(a.debt, v.value);
        v.spentTodayNow = _spentTodayNow(a);
    }

    // ───────────── admin ─────────────

    function registerShop(address shop, string calldata name) external onlyOwner {
        shopName[shop] = name;
        emit ShopRegistered(shop, name);
    }

    function setTreasury(address t) external onlyOwner {
        treasury = t;
    }

    function setOperator(address o) external onlyOwner {
        operator = o;
    }

    /// Rehearsal helper only: sends the user's shares to the treasury and lets them join again.
    function resetAccount(address user) external onlyOwner nonReentrant {
        uint256 s = accounts[user].shares;
        delete accounts[user];
        if (s > 0) require(stock.transfer(treasury, s));
    }

    // ───────────── math ─────────────

    function _value(uint256 shares, uint256 p) internal pure returns (uint256) {
        return shares * p / 1e18;
    }

    /// Rounds up so selling these shares always fully covers `usdAmt`.
    function _sharesFor(uint256 usdAmt, uint256 p) internal pure returns (uint256) {
        return Math.ceilDiv(usdAmt * 1e18, p);
    }

    function _fee(uint256 amount) internal pure returns (uint256) {
        return amount * FEE_BPS / BPS;
    }

    function _health(uint256 debt, uint256 v) internal pure returns (uint256) {
        if (debt == 0) return 0;
        if (v == 0) return type(uint256).max;
        return debt * BPS / v;
    }

    function _spentTodayNow(Account storage a) internal view returns (uint256) {
        return a.dayIndex == block.timestamp / 1 days ? a.spentToday : 0;
    }
}
