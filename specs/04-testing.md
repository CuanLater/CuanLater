# 04 · Testing and acceptance

Contracts are tested in Foundry with exact numbers. The app is checked against the demo numbers by hand (and with Playwright if time allows). Nothing is announced unless its row in "Acceptance by requirement" passes on Monad testnet.

## Foundry setup

- `test/CuanLater.t.sol` deploys the three contracts, funds the pool with 10,000 tUSD, registers `shop`, and uses users `alice`, `budi`.
- Weekend: `vm.warp` to Saturday 24 Oct 2026 12:00 UTC (`1792843200`); weekday: Monday 26 Oct 2026 12:00 UTC (`1793016000`).
- Price: `vm.roll` relative to `tapeStart`, or `setTape` with a two-point tape for unit tests.
- Use `assertEq` on base units (6 dec for money, 18 dec for shares). Rounded-up share amounts are checked with the formulas in `01-contracts.md`.

## Contract test cases

| ID | Case | Setup | Expect |
| --- | --- | --- | --- |
| T1 | Join | alice `join()` at price $40 | shares `1e18`, principal `40_000000`, entryPrice `40_000000`, autoRepay true, `Joined` emitted; second `join()` reverts `AlreadyJoined` |
| T2 | Coffee by card | weekend; `tryPay(shop, 3_000000, CARD, id1)` | ok; debt `3_015000`; shop +`3_000000` tUSD; shares unchanged; `Paid(..., fee 15000, debtAfter 3015000, CARD, id1)` |
| T3 | Es teh by QRIS | after T2; `tryPay(shop, 500000, QRIS, id2)` | ok; debt `3_517500`; `availableOf` = `6_482500` |
| T4 | Weekend limit | after T3; `tryPay(shop, 10_000000, CARD, id3)` | returns `(false, OVER_WEEKEND_LIMIT)`; `Declined(... a = 13_567500, b = 10_000000)`; debt unchanged; shop balance unchanged |
| T5 | Weekday limit | weekday; fresh user; `tryPay(14_000000)` | declined `OVER_WEEKDAY_LIMIT` (14.07 > 14.00); `tryPay(13_000000)` ok |
| T6 | `pay` reverts | as T4 but `pay` | reverts `OverWeekendLimit(13_567500, 10_000000)` |
| T7 | Freeze | `freeze()`; `tryPay(5_000000)` | declined `FROZEN`; `unfreeze()`; same payment ok (weekday) |
| T8 | Unknown shop | pay to a random address | declined `UNKNOWN_SHOP` |
| T9 | Not joined | budi pays before joining | declined `NOT_JOINED` |
| T10 | Pool empty | drain pool; pay | declined `POOL_EMPTY` |
| T11 | Tape | before `startTape`: price `40_000000`; after start + 36 blocks: `44_000000`; mid-dip index shows `39_200000`; `startTape` while running reverts `TapeRunning`; `resetTape` → `40_000000` |
| T12 | Cash repay | after T3; `topUp()`; `repay(3_517500)` | debt 0; user tUSD 10 → `6_482500`; `Repaid(..., CASH)`; no `approve` needed |
| T13 | Profit pays | after T3, price $44, `harvestMany([alice])` | paid `3_517500`; sold = ceil(3_517500e18 / 44_000000) = `79943181818181819`; shares `920056818181818181`; debt 0; principal still `40_000000`; treasury +sold; `ProfitRepaid` |
| T14 | Profit pays only profit | price $41 (profit $1.00), debt $3.5175 | paid `1_000000`; debt `2_517500`; value after = principal ($40.00, within 1 unit) |
| T15 | Auto-repay off | `setAutoRepay(false)`, price $44, harvest | nothing changes |
| T16 | No profit | price $40 or below, harvest | nothing changes |
| T17 | harvestRange | 3 members, only one harvestable | one `ProfitRepaid`; others untouched |
| T18 | Stock repay (R10) | debt `3_517500`, price $40, `repayWithStock()` | sold = `87937500000000000`; debt 0; principal scaled to `40_000000 × (1 − 0.0879375)` |
| T19 | Safety sell (R11) | budi: debt `10_050000`, price $20 (`health` 5025) | `liquidate` sells x = `4_692308` (ceil), shares ≈ 0.2346; `health` ≈ 3500 after (±1) |
| T20 | Not liquidatable | health 4568 (price $22) | `liquidate` reverts `NotLiquidatable(4568)` |
| T21 | Daily limit (R9) | `setDailyLimit(5_000000)`; pay 3, then 3 | second declined `OVER_DAILY_LIMIT`; next UTC day (`vm.warp +1 days`) it passes |
| T22 | Tap limit (R16) | `setTapLimit(5_000000)`; shop `charge(alice, 3_000000, CARD, id)` | ok; `charge(6_000000)` declined `OVER_TAP_LIMIT`; non-shop caller reverts |
| T23 | repayFor (R15) | operator holds tUSD; `repayFor(alice, 1_000000)` | debt −1; `Repaid(..., OPERATOR)`; non-operator reverts `NotOperator` |
| T24 | Withdraw | debt > 0 → `withdraw` reverts `DebtOutstanding`; debt 0 → withdraw all, wallet receives shares |
| T25 | Weekend math | for each day 24–30 Oct 2026 | `isWeekend` true only for Sat 24 and Sun 25 |
| T26 | Fuzz | random amounts ≤ limit | `debt` always equals the sum of `amount + fee` minus repayments; the vault's tNVDA balance equals the sum of all shares |

Run `forge test -vv` and `forge coverage` before deploy; T1–T13 and T25 are blocking.

## App checks (manual, on testnet)

| ID | Check | Pass |
| --- | --- | --- |
| A1 | New phone, new email, 0 MON | Joins and sees the card in < 30 s |
| A2 | Card home numbers after join (Saturday) | "$10.00" available, "25% of your stock · weekend limit", "1 tNVDA ≈ $40.00 locked" |
| A3 | Card-tap coffee from `/terminal` to `/card` (two tabs and two devices) | Request appears on the phone; Approve → terminal APPROVED in ~1 s; explorer link opens the tx |
| A4 | QRIS es teh | Terminal shows QR; phone simulated scan runs 1 s; APPROVED; both rails in Recent sales |
| A5 | Scanning the terminal QR with a real phone camera | Opens `/card/pay?...` with the right amount and rail |
| A6 | Freeze → sticker | Phone shows the frozen decline screen; terminal shows DECLINED "Card frozen by its owner · nothing charged" |
| A7 | T-shirt | Weekend decline with "≈ $13.57 · over by $3.57" |
| A8 | Start price replay + keeper | Debt goes to $0.00 within a few blocks after $44; profit screen shows 0.0799 / 0.9201 / $40.48 |
| A9 | Harvest now with the keeper stopped | Same result as A8 |
| A10 | Cash repay | `/card/repay` "Pay $3.52 with cash" after Top up → $0.00 owed |
| A11 | 360 px wide phone | No horizontal scroll, buttons ≥ 44 px |
| A12 | `/demo` on a 1440 × 810 screen | Everything fits; "Last block" shows a measured number |

## Acceptance by requirement

| Req | Contract tests | App checks |
| --- | --- | --- |
| R1 | — | A1 |
| R2 | T1 | A1, A2 |
| R3 | T2, T3 | A3, A4 |
| R4 | T4, T5, T6, T25 | A7 |
| R5 | T13–T17 | A8, A9 |
| R6 | T12, T24 | A10 |
| R7 | T2, T3 (rail in event) | A3, A4, A5 |
| R8 | T7 | A6 |
| R9 | T21 | Set limit, decline shown |
| R10 | T18 | Repay with stock button |
| R11 | T19, T20 | Safety screen numbers match contract |
| R14 | Same suite against a mainnet fork | Mainnet addresses in README |
| R15 | T23 | Sandbox payment → Repaid (OPERATOR) |
| R16 | T22 | Coffee goes through on Charge alone |
