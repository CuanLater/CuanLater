# CuanLater specs

Build specs for **CuanLater** (the app) and **Cuan Card** (its virtual card), made for Monad Blitz Jogja Vol. 2 on 24 Oct 2026. They come from the CuanLater PRD and the CuanLater flow mockups. When the PRD and these files disagree, these files win, because they are the newer and more exact version.

## Files

| File | What it covers | Read it when |
| --- | --- | --- |
| [00-overview.md](00-overview.md) | Product in one page, glossary, scope (Must / Bonus / Next), shared constants, demo numbers, claim rules | Always first |
| [01-contracts.md](01-contracts.md) | `CuanLater.sol`, `MockStock.sol`, `MockUSD.sol`: storage, math, every function, events, errors, deploy | Building or testing contracts |
| [02-frontend.md](02-frontend.md) | Next.js app: routes, screens mapped to mockup boards, copy, state, terminal-to-phone messaging, QR payload, formatting | Building the web app |
| [03-offchain.md](03-offchain.md) | Login and gas sponsorship, profit keeper, RPC, env vars, Midtrans webhook (bonus), hosting, README for judges | Wiring infra and scripts |
| [04-testing.md](04-testing.md) | Foundry test cases with exact numbers, frontend checks, acceptance criteria per requirement | Before calling anything done |
| [05-demo-runbook.md](05-demo-runbook.md) | 60-second demo script, reset steps, fallbacks, judging checklist | Rehearsal and stage |

## Repo layout to create

```
cuanlater/
├─ contracts/                 Foundry project
│  ├─ src/CuanLater.sol
│  ├─ src/MockStock.sol
│  ├─ src/MockUSD.sol
│  ├─ script/Deploy.s.sol
│  ├─ test/CuanLater.t.sol
│  └─ foundry.toml
├─ app/                       Next.js 16 app (App Router)
│  ├─ app/(marketing)/page.tsx        landing  → /
│  ├─ app/card/...                    phone    → /card
│  ├─ app/terminal/page.tsx           terminal → /terminal
│  ├─ app/demo/page.tsx               projector layout → /demo
│  ├─ app/api/midtrans/...            bonus only
│  ├─ lib/ (abi, chain, format, rails, messaging)
│  └─ package.json
├─ keeper/                    profit robot (Node script)
├─ specs/                     these files
└─ README.md                  judge-facing, see 03-offchain.md
```

## Build order (today)

Work top to bottom. Each step ends with something that runs. Times are targets for 24 Oct (Asia/Jakarta).

1. **Contracts core (until ~13:00).** `MockStock`, `MockUSD`, `CuanLater` with `join`, `tryPay`, limits, `freeze`, tape `price()`, `repay`. Foundry tests T1–T12 pass. Deploy to Monad testnet and verify.
2. **Phone + terminal happy path (until ~14:30).** Privy login, join, home card, terminal card-tap charge → phone Approve → APPROVED with explorer link.
3. **Profit pays (until ~15:15).** `harvest` / `harvestMany`, keeper script, `startTape`, Harvest now button, profit-paid screen.
4. **QRIS rail + declines (until ~16:00).** QRIS terminal mode, simulated scan, frozen and weekend-limit declines shown on both screens.
5. **Live demo layout + landing (until ~16:45).** `/demo` split screen with price strip; landing page.
6. **17:00 feature freeze.** Only Must items that pass `04-testing.md` get announced. Bonus items (daily limit, stock repay, safety sell, tap limit, Midtrans, mainnet) ship only if done before the freeze.
7. **After freeze.** README, demo video at 17:45, posts, rehearse with `05-demo-runbook.md`.

## Definition of done (Must)

- R1–R8 from `00-overview.md` pass their checks in `04-testing.md`.
- Contracts deployed on Monad testnet, verified, addresses in the README.
- Public repo, public URL, someone else can run it from the README.
- The demo runbook works end to end twice in a row with a reset in between.
