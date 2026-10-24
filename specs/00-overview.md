# 00 · Overview

## The product in one paragraph

CuanLater lets someone pay at a shop with **Cuan Card**, a virtual card backed by their stock. Paying borrows a little against the locked stock instead of selling it. When the stock price rises above where it started, the profit pays the debt automatically, checked every Monad block ("Bayar pakai cuan"). Borrowing limits tighten on weekends, when stock markets are closed. Two payment rails, **card tap** and a **simulated QRIS scan**, both end in the same on-chain payment.

## Glossary

| Term | Meaning |
| --- | --- |
| tNVDA | `MockStock`, a demo ERC-20 standing in for a tokenized Nvidia share. 18 decimals. |
| tUSD | `MockUSD`, a demo dollar ERC-20. 6 decimals. |
| Vault | The `CuanLater` contract. Holds every user's locked tNVDA and records their debt. Also holds the lending pool of tUSD. |
| Treasury | An address set at deploy. Receives tNVDA whenever stock is sold to repay debt (profit pay, stock repay, safety sell). It acts as the buyer at the tape price. |
| Principal | The USD value of the user's stock when they joined ($40.00). Profit is anything above it. |
| Tape | The recorded price curve stored in the contract and read by block number. No live price feed. |
| Rail | How the shop charged: `CARD` (card tap) or `QRIS` (simulated QRIS scan). Recorded in events. |
| Keeper | Off-chain script that calls `harvestMany` every block. Anyone may call it. |
| Health | Debt divided by stock value, in basis points. |

## Scope

Only **Must** items are announced on stage. **Bonus** items are built only after all Must items pass, and are announced only if they work by the 17:00 freeze. **Next** is pitch-only.

| ID | Requirement | Priority | Done when |
| --- | --- | --- | --- |
| R1 | Email login, no wallet app, fees paid for the user | Must | A new phone joins in under 30 s holding zero MON |
| R2 | Join gives 1 tNVDA, locked, with a $40.00 principal | Must | `Joined` event shows shares and principal |
| R3 | Pay a shop by borrowing; stock sold = 0 | Must | Shop tUSD balance rises by the amount in the same block; user shares unchanged |
| R4 | Weekend limit 25%, weekday 35% | Must | A payment that would push debt over the limit is declined with reason and amounts |
| R5 | Bayar pakai cuan: profit pays the debt every block | Must | During the tape rise, debt goes to $0 and only profit is sold |
| R6 | Pay back with cash | Must | `Repaid` event; debt falls; stock withdrawable at $0 debt |
| R7 | Cuan Card look on the phone + shop terminal with two rails (card tap, simulated QRIS); same contract call | Must | Terminal shows APPROVED or DECLINED within ~1 s of Approve; each sale shows its rail |
| R8 | Freeze and unfreeze the card | Must | Frozen card is declined from the next block; unfrozen works again |
| R9 | Daily spending limit | Bonus | Payment over the daily limit is declined |
| R10 | Pay back with a little stock | Bonus | Debt cleared by selling just enough shares |
| R11 | Safety sell above 50% | Bonus | Only callable past the line; restores 35% |
| R12 | Health bar (Safe / Careful / Auto-sell) | Bonus | Bar matches on-chain ratio |
| R13 | Rem darurat (user-set stop) | Next | Pitch only |
| R14 | Same contracts on Monad mainnet | Bonus | Mainnet addresses in README |
| R15 | Pay back in rupiah via Midtrans sandbox | Bonus | Sandbox success → `repayFor` → `Repaid` |
| R16 | Tap limit: small payments skip Approve | Bonus | With a $5 tap limit, the shop's `charge` succeeds without a phone tap |

## Shared constants

Every app, test and script uses these values. Keep them in one place per codebase (`contracts/src/CuanLater.sol` constants and `app/lib/constants.ts`).

| Name | Value | Notes |
| --- | --- | --- |
| Chain | Monad testnet, chain ID `10143` | Mainnet for R14 only |
| `SHARES_PER_JOIN` | `1e18` (1 tNVDA) | One join per address |
| `FEE_BPS` | `50` (0.5%) | Added to debt at payment |
| `WEEKDAY_LIMIT_BPS` | `3500` | Max debt / stock value, Mon–Fri UTC |
| `WEEKEND_LIMIT_BPS` | `2500` | Sat–Sun UTC |
| `CAREFUL_BPS` | `3500` | Health bar turns yellow at or above |
| `LIQUIDATION_BPS` | `5000` | Safety sell allowed strictly above |
| `TARGET_BPS` | `3500` | Safety sell brings health back to this |
| Weekend check | `((block.timestamp / 1 days) + 4) % 7` → `0` = Sun, `6` = Sat | UTC days; known simplification |
| Price units | tUSD per 1 whole tNVDA, 6 decimals | `40_000000` = $40.00 |
| Tape | 40.00 flat → small dip to 39.20 → rise to 44.00 | See `01-contracts.md` |
| Display FX | Rp 16.000 per $1, fixed | Display only; label "≈" |
| Shop | Kantin Blitz, NMID text `ID102026MONAD` (demo label) | Registered in the contract |
| Items | Coffee $3.00, Es teh $0.50, Sticker $5.00, T-shirt $10.00 | Terminal presets |

## Demo numbers (must match everywhere)

| Moment | Value |
| --- | --- |
| After join | 1.0000 tNVDA ≈ $40.00, available today $10.00 (weekend) |
| Coffee $3.00 by card tap | Debt $3.015 → shown **$3.02**; left today $6.98 |
| Es teh $0.50 by QRIS | Debt $3.5175 → shown **$3.52**; left today $6.48 |
| Sticker $5.00 while frozen | Declined: card frozen; nothing charged |
| T-shirt $10.00 | Declined: would owe ≈ $13.57, $3.57 over $10.00 |
| Tape at $44.00 | Profit $4.00; $3.52 pays both; 0.0799 tNVDA sold; 0.9201 tNVDA ≈ $40.48 left |

Money is shown rounded half-up to cents. Shares are shown to 4 decimals.

## Non-goals today

Real stocks or prices, a real Visa or Mastercard card, real QRIS settlement, lender sign-up, interest that grows over time, a big projector screen for audience joining, live camera scanning.

## Claim rules (copy, pitch, README)

- Say "your starting value is never touched", never "your stock is never touched".
- Never say "first stock-backed card" or "fully autonomous" (a keeper triggers the check).
- The card network badge always says **Sandbox**; no Visa/Mastercard/QRIS/GPN logos. Plain-text mentions only.
- The QR code holds CuanLater's own payment link, not a real QRIS string. The standee says "Sandbox · not a real QRIS code".
- Prices are labelled REPLAY.
