# 01 · Contracts

Three contracts, Solidity 0.8.38, Foundry v1.8.6, OpenZeppelin Contracts 5.6.1. All on Monad testnet (chain ID 10143); the same code deploys to mainnet for R14.

| Contract | Role |
| --- | --- |
| `MockStock` | tNVDA, ERC-20, 18 decimals. Mintable by `CuanLater` only. |
| `MockUSD` | tUSD, ERC-20, 6 decimals. Mintable by owner and `CuanLater`. Demo shortcut: `CuanLater` is a trusted spender (no `approve` needed). |
| `CuanLater` | The vault: accounts, lending pool, limits, card controls, price tape, profit pay, repay, safety sell. |

## Units and rounding

- Shares: 18 decimals (`1e18` = 1 tNVDA).
- Money (tUSD, debt, principal, limits): 6 decimals (`3_015000` = $3.015).
- Price: tUSD per 1 whole tNVDA, 6 decimals (`40_000000` = $40.00).
- `value(shares, price) = shares * price / 1e18` (rounds down).
- `sharesFor(usd, price) = ceil(usd * 1e18 / price)`: when selling stock to cover a debt, round shares **up** so debt is always fully covered.
- Fee: `fee = amount * FEE_BPS / 10_000` (rounds down). $3.00 → $0.015.

## MockStock

```solidity
contract MockStock is ERC20("Test Nvidia", "tNVDA"), Ownable {
    mapping(address => bool) public minter;
    function setMinter(address who, bool ok) external onlyOwner;
    function mint(address to, uint256 amount) external; // require(minter[msg.sender])
}
```

## MockUSD

```solidity
contract MockUSD is ERC20("Test USD", "tUSD"), Ownable {
    mapping(address => bool) public minter;          // owner + CuanLater
    address public trustedSpender;                    // CuanLater
    function decimals() public pure override returns (uint8) { return 6; }
    function setMinter(address who, bool ok) external onlyOwner;
    function setTrustedSpender(address who) external onlyOwner;
    function mint(address to, uint256 amount) external; // require(minter[msg.sender] || msg.sender == owner())
    // allowance(owner, trustedSpender) returns type(uint256).max, and transferFrom by trustedSpender skips the allowance check.
}
```

The trusted-spender shortcut exists only so a cash repay is one transaction. Label it in code comments as demo-only.

## CuanLater: storage

```solidity
enum Rail   { CARD, QRIS }
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

IERC20  public immutable stock;     // MockStock
IERC20  public immutable usd;       // MockUSD
address public treasury;            // receives sold shares
address public operator;            // may call repayFor (R15)
mapping(address => Account) public accounts;
address[] public members;           // every joined address, for the keeper
mapping(address => string) public shopName;   // non-empty = registered shop
uint32[] public tape;               // prices, 6 dec
uint256 public tapeStart;           // block number; 0 = not started
uint256 public tapeStep;            // blocks per tape point
```

Constants as in `00-overview.md`: `SHARES_PER_JOIN = 1e18`, `FEE_BPS = 50`, `WEEKDAY_LIMIT_BPS = 3500`, `WEEKEND_LIMIT_BPS = 2500`, `LIQUIDATION_BPS = 5000`, `TARGET_BPS = 3500`, `TOP_UP = 10e6`.

Accounts are keyed by `msg.sender`, which is the user's Privy smart-wallet address.

## Price tape

```solidity
function price() public view returns (uint256) {
    if (tapeStart == 0) return tape[0];
    uint256 i = (block.number - tapeStart) / tapeStep;
    return i < tape.length ? tape[i] : tape[tape.length - 1];
}
function startTape() external;                 // anyone; reverts TapeRunning() if started and not finished
function resetTape() external onlyOwner;       // tapeStart = 0 (price back to tape[0])
function setTape(uint32[] calldata points, uint256 step) external onlyOwner;
```

Default tape, `tapeStep = 2` (tune after measuring testnet block time so the rise takes about 12–15 s):

```
40.00 40.00 40.00 40.00 40.00 40.00 39.80 39.50 39.20 39.50 40.00 40.60 41.20 41.80 42.40 43.00 43.50 44.00
```

18 points × 2 blocks = 36 blocks. After the last point the price stays at $44.00 until `resetTape`.

## CuanLater: functions

### Joining and card controls

| Function | Caller | Rules and effects | Emits |
| --- | --- | --- | --- |
| `join()` | User | Reverts `AlreadyJoined` if joined. Mints `SHARES_PER_JOIN` tNVDA to the vault for the user. `entryPrice = price()`, `principal = value(shares, price())`, `autoRepay = true`. Pushes to `members`. | `Joined(user, shares, entryPrice, principal)` |
| `setAutoRepay(bool on)` | User | Toggles Bayar pakai cuan. | `AutoRepaySet(user, on)` |
| `freeze()` / `unfreeze()` | User | Sets `frozen`. Takes effect from the next transaction. | `Frozen(user)` / `Unfrozen(user)` |
| `setDailyLimit(uint256 amount)` | User | 0 = off. (R9) | `DailyLimitSet(user, amount)` |
| `setTapLimit(uint256 amount)` | User | 0 = off. (R16) | `TapLimitSet(user, amount)` |
| `topUp()` | Joined user | Mints `TOP_UP` ($10) tUSD to the caller ("pretend salary"). | ERC-20 `Transfer` |

### Paying

Both rails call the same function. The rail and an order ID from the terminal are recorded in the event so the terminal can match the result.

```solidity
function tryPay(address shop, uint256 amount, Rail rail, bytes32 orderId) external returns (bool ok, Reason reason);
function pay(address shop, uint256 amount, Rail rail, bytes32 orderId) external;              // same rules, reverts with custom errors
function charge(address user, uint256 amount, Rail rail, bytes32 orderId) external returns (bool ok, Reason reason); // shop pulls, R16
```

The app always uses `tryPay`, so declines are on-chain events the terminal can show. `pay` exists for scripts and tests.

**Checks, in this order** (the first failure is the reason):

1. `NOT_JOINED`: `!accounts[user].joined`
2. `UNKNOWN_SHOP`: `bytes(shopName[shop]).length == 0`
3. `FROZEN`: `accounts[user].frozen`
4. `ZERO_AMOUNT`: `amount == 0`
5. Limit: `wouldOwe = debt + amount + fee(amount)`; `limit = value(shares, price()) * limitBps() / 10_000`. If `wouldOwe > limit` → `OVER_WEEKEND_LIMIT` when `isWeekend()`, else `OVER_WEEKDAY_LIMIT`.
6. `OVER_DAILY_LIMIT`: `dailyLimit > 0 && spentTodayNow + amount > dailyLimit`, where `spentTodayNow` is 0 if `dayIndex != block.timestamp / 1 days`.
7. `OVER_TAP_LIMIT` (only in `charge`): `tapLimit == 0 || amount > tapLimit`. `charge` also requires `msg.sender` to be a registered shop, which becomes the `shop`.
8. `POOL_EMPTY`: `usd.balanceOf(address(this)) < amount`

**On success:** roll `dayIndex` / `spentToday` if the day changed; `spentToday += amount`; `debt += amount + fee`; transfer `amount` tUSD from the vault to `shop`. Shares do not change.

**Emits:** `Paid(user, shop, amount, fee, debtAfter, rail, orderId)` on success; `Declined(user, shop, amount, rail, orderId, reason, wouldOwe, limit)` on failure (for `OVER_DAILY_LIMIT` put `spentTodayNow + amount` and `dailyLimit` in the last two fields; for `OVER_TAP_LIMIT`, `amount` and `tapLimit`; otherwise `wouldOwe` and `limit`).

`pay` reverts with `NotJoined()`, `UnknownShop()`, `CardFrozen()`, `ZeroAmount()`, `OverWeekendLimit(wouldOwe, limit)`, `OverWeekdayLimit(wouldOwe, limit)`, `OverDailyLimit(asked, left)`, `PoolEmpty()`.

### Profit pays (Bayar pakai cuan)

```solidity
function harvestMany(address[] calldata users) external;          // anyone; cap 50 per call in the keeper
function harvestRange(uint256 from, uint256 count) external;      // anyone; walks members[from .. from+count)
```

Per user, skip unless `autoRepay && debt > 0`. Then:

```
v      = value(shares, price())
if v <= principal: skip
profit = v - principal
paid   = min(debt, profit)
sold   = min(sharesFor(paid, price()), shares)
shares -= sold;  debt -= paid
stock.transfer(treasury, sold)
```

`principal` does **not** change on harvest, so later profit is measured from the same starting value. This is what keeps "your starting value is never touched" true: after the demo, 0.9201 tNVDA × $44 = $40.48 ≥ $40.00.

Emits `ProfitRepaid(user, paid, sold, price, debtAfter)`.

### Paying back yourself

| Function | Caller | Effect | Emits |
| --- | --- | --- | --- |
| `repay(uint256 amount)` | User | `amt = min(amount, debt)`; pull `amt` tUSD from the user (trusted spender); `debt -= amt`. | `Repaid(user, amt, debtAfter, CASH)` |
| `repayWithStock()` | User (R10) | `sold = sharesFor(debt, price())`, revert if `> shares`; scale `principal -= principal * sold / shares` (before reducing shares); `shares -= sold`; send to treasury; `debt = 0`. | `Repaid(user, paidUsd, 0, STOCK)` |
| `repayFor(address user, uint256 amount)` | `operator` only (R15) | Same as `repay` but pulls tUSD from the operator. | `Repaid(user, amt, debtAfter, OPERATOR)` |
| `withdraw(uint256 sharesOut)` | User | Only when `debt == 0`; scale `principal` down by the same fraction; transfer shares to the user's wallet. Reverts `DebtOutstanding()` otherwise. | `Withdrawn(user, sharesOut)` |

### Safety sell (R11)

```solidity
function liquidate(address user) external;   // anyone
```

```
v = value(shares, price());  h = debt * 10_000 / v
require(h > LIQUIDATION_BPS)  else revert NotLiquidatable(h)
x    = ceil((debt * 10_000 - v * TARGET_BPS) / (10_000 - TARGET_BPS))   // USD to sell so health returns to 35%
sold = min(sharesFor(x, price()), shares)
principal -= principal * sold / shares;  shares -= sold;  debt -= min(x, debt)
stock.transfer(treasury, sold)
```

If `debt >= v` (underwater), sell all shares and leave the rest as bad debt; emit anyway. Emits `Liquidated(user, x, sold, price, healthAfterBps)`.

Example (Budi): $10.05 owed, price $20.00 → health 50.25% → sell $4.6923 (0.2346 tNVDA) → health 35.00%.

### Views

| View | Returns |
| --- | --- |
| `price()` | Current tape price |
| `isWeekend()` | `((block.timestamp / 1 days) + 4) % 7` is 0 or 6 |
| `limitBps()` | 2500 on weekends, 3500 otherwise |
| `valueOf(user)` | `value(shares, price())` |
| `limitOf(user)` | `valueOf * limitBps / 10_000` |
| `availableOf(user)` | `limitOf - debt`, floored at 0 (fee not subtracted; the UI says "Available to spend today") |
| `health(user)` | `debt * 10_000 / valueOf` (0 if no debt) |
| `accountView(user)` | One struct with every field above plus `price`, `isWeekend`, `limitBps`, `spentTodayNow`, for a single frontend read |
| `membersLength()` | For `harvestRange` paging |

### Admin

| Function | Notes |
| --- | --- |
| `registerShop(address shop, string name)` | Kantin Blitz at deploy. Emits `ShopRegistered`. |
| `setTreasury(address)`, `setOperator(address)` | Owner only. |
| `setTape`, `resetTape` | See tape. |
| `resetAccount(address user)` | Owner only, rehearsal helper: sends the user's shares to the treasury, clears debt, deletes the account so they can join again. Never used on stage. |

There is no admin override for the weekend check. The Refused screen says "nobody can switch it, not even us", so keep it that way.

## Events and errors (full list)

```solidity
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

error NotJoined(); error AlreadyJoined(); error UnknownShop(); error CardFrozen(); error ZeroAmount();
error OverWeekendLimit(uint256 wouldOwe, uint256 limit);
error OverWeekdayLimit(uint256 wouldOwe, uint256 limit);
error OverDailyLimit(uint256 asked, uint256 left);
error OverTapLimit(uint256 asked, uint256 tapLimit);
error PoolEmpty(); error NotLiquidatable(uint256 healthBps); error DebtOutstanding(); error NotOperator(); error TapeRunning();
```

## Safety and gas

- `ReentrancyGuard` on every function that moves tokens; checks-effects-interactions order.
- `tryPay` and `charge` must not revert on rule failures; only on unexpected errors.
- Monad charges the **gas limit**, not gas used. Measure each call with `cast estimate` and send with about +20% as an explicit limit. Starting points: `join` 250k, `tryPay` 180k, `harvestMany(50)` measured, `repay` 120k.
- Keep `harvestMany` batches at 50 or fewer.
- Contract size stays far below the 128 KB limit.

## Deploy (`script/Deploy.s.sol`)

1. Deploy `MockStock`, `MockUSD`.
2. Deploy `CuanLater(stock, usd, treasury, operator, tape, tapeStep)`.
3. `stock.setMinter(cuanLater, true)`; `usd.setMinter(cuanLater, true)`; `usd.setTrustedSpender(cuanLater)`.
4. Mint 10,000 tUSD to `cuanLater` (the lending pool).
5. `registerShop(SHOP_ADDRESS, "Kantin Blitz")`.
6. Write addresses and the deploy block to `deployments/<chainId>.json` for the app and keeper.
7. Verify all three contracts on the Monad explorer (`forge verify-contract`; take the verifier settings from Monad's docs).

Env: `PRIVATE_KEY` (deployer), `TREASURY_ADDRESS`, `OPERATOR_ADDRESS`, `SHOP_ADDRESS`, `RPC_URL`. The deployer and every wallet that sends value must hold more than 10 MON (Monad reserve rule).
