# 03 · Off-chain parts

Everything that is not the contract or the web UI: login and gas, the keeper, RPC, config, the bonus Midtrans webhook, hosting, and the judge-facing README.

## Login and gas sponsorship (R1)

**Plan A (try first, decide within the first hour):** Privy email login with **smart wallets** on Monad testnet, gas sponsored by a **Pimlico** paymaster configured in the Privy dashboard.

- Packages: `@privy-io/react-auth` 3.51.0, `@privy-io/wagmi` 4.0.19, `permissionless` 0.2.57 (Privy's smart wallets need 0.2.x), `viem` pinned to 2.57.8 with an npm `overrides` entry so only one copy is installed.
- Every write (`join`, `tryPay`, `freeze`, `repay`, …) goes through the smart-wallet client. The user never holds MON.
- Accounts in the contract are keyed by the smart-wallet address.
- Success test: a fresh phone, new email, joins and pays a coffee with 0 MON in under 30 s.

**Plan B (if sponsorship fails on testnet):** a relayer API route (`/api/relay`) that sends transactions from 3 rotating server keys, each funded above the 10 MON reserve. The contract then needs `msg.sender`-independent calls, so for Plan B add `payFor(user, …)`-style functions guarded by an EIP-712 signature from the user's embedded wallet. Only build Plan B if Plan A fails; note the switch in the README.

## Profit keeper (`keeper/`)

A Node 24 script, `npm run keeper`.

```
loop on every new block (watchBlocks):
  n = membersLength()
  for from in 0..n step 50:
    if any member in the page has debt > 0 and autoRepay and value > principal (read via accountView):
      send harvestRange(from, 50) with an explicit gas limit (measured + 20%)
  log "{block} harvested {count} users, paid {sum}"
```

- Own wallet (`KEEPER_PRIVATE_KEY`), funded above 10 MON plus gas.
- Skip sending when nothing is harvestable, so it doesn't burn gas every block.
- Never sends more than one transaction per block; if one is pending, wait.
- The `/demo` "Harvest now" button is the manual fallback; anyone can call `harvestRange`.
- Run it locally on the presenter laptop during the demo (no server needed), and as a background process on any machine during judging.

## RPC

- Primary: a private Monad testnet RPC key (`NEXT_PUBLIC_RPC_URL`, `RPC_URL`).
- Fallback: the public Monad testnet RPC as a viem `fallback` transport.
- Optional: `eth_sendRawTransactionSync` for server-sent transactions (keeper, relayer) to get the receipt in one round trip.
- Public RPC is rate-limited; never poll faster than 500 ms per client.

## Environment variables

| Name | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAIN_ID` | app | `10143` |
| `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_RPC_FALLBACK_URL` | app | |
| `NEXT_PUBLIC_EXPLORER_URL` | app | Monad testnet explorer base URL |
| `NEXT_PUBLIC_PRIVY_APP_ID` | app | Privy dashboard |
| `NEXT_PUBLIC_CUANLATER_ADDRESS`, `NEXT_PUBLIC_USD_ADDRESS`, `NEXT_PUBLIC_STOCK_ADDRESS`, `NEXT_PUBLIC_SHOP_ADDRESS` | app | From `deployments/10143.json` |
| `RPC_URL`, `PRIVATE_KEY` | contracts deploy | Deployer > 10 MON |
| `TREASURY_ADDRESS`, `OPERATOR_ADDRESS`, `SHOP_ADDRESS` | deploy | |
| `KEEPER_PRIVATE_KEY` | keeper | > 10 MON |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `OPERATOR_PRIVATE_KEY` | Midtrans route (bonus) | Server only, never `NEXT_PUBLIC_` |

Provide `.env.example` files with every name and no values.

## Midtrans sandbox repay (R15, bonus)

Build only after every Must item passes. Not part of the 60-second demo.

1. `/card/repay` link "Or pay in rupiah with GoPay or QRIS" calls `POST /api/midtrans/charge` with `{ user, amountUsd }`.
2. The route converts at the fixed demo rate (Rp 16.000 per $1, rounded up to the nearest Rp 100), creates a Midtrans **sandbox** charge (GoPay or QRIS) with `order_id = cuanlater-{user}-{timestamp}` via `midtrans-client` 1.4.3, and returns the payment URL or QR for the user.
3. `POST /api/midtrans/notify` (the Midtrans notification URL) verifies the notification signature (`sha512(order_id + status_code + gross_amount + serverKey)`), checks `transaction_status` is `settlement` or `capture`, makes sure the `order_id` has not been processed before, then sends `repayFor(user, amountUsd)` from the operator wallet (which holds tUSD).
4. The phone sees the `Repaid` event with source `OPERATOR` and shows "Paid back in rupiah (sandbox)".

Validate both request bodies with zod 4.6.7. Sandbox moves no real money; say so in the UI ("SANDBOX" tag).

## Hosting and domain

- Vercel project for `app/` on Node 24. Public URL in the README.
- Custom domain (+15 bonus): point a cheap domain at Vercel.
- The keeper is not on Vercel (it needs a long-running process).

## Judge-facing README (repo root)

Must contain, in this order:

1. One-line pitch and the 20-second explanation (pay with stock, profit pays the debt, weekend-aware limit).
2. Live URL and a 30 s+ demo video link.
3. Contract addresses: Monad testnet (and mainnet if R14), each linked to the verified page on the explorer.
4. "Run it yourself" in at most 5 commands: clone, `cp .env.example .env`, fill 3 values, `forge script … --broadcast` (or use our deployed addresses), `npm i && npm run dev`, `npm run keeper`.
5. How to try it: open `/terminal` on a laptop and `/card` on a phone, or `/demo` on one screen.
6. What's real and what's pretend (same list as the landing page).
7. Tech stack table with pinned versions (copy from the PRD).
8. Team and the tags @monad @monad_dev @geeky_kartikey.

Ask someone outside the team to follow it at 16:30; fix whatever they trip on.
