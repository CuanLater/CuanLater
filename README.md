# CuanLater · Cuan Card

**Jajan pakai saham, bayar pakai cuan.**
Pay at a shop with your stock, without selling it. When your stock goes up, the profit pays the bill.

Built at Monad Blitz Jogja Vol. 2. Runs on Monad testnet.

- **App:** https://www.cuanlater.xyz/
- **Demo video:** `TODO`

## How it works

1. **You join.** You get 1 tNVDA (a demo stock worth $40). It stays locked as your guarantee.
2. **You pay.** Tap your Cuan Card at the shop, or scan the shop's QR. The shop gets paid right away.
3. **Nothing is sold.** Instead, you owe a small debt (plus a 0.5% fee).
4. **Profit pays the debt.** When the stock price rises above where you started, the profit pays your debt for you. This is checked every block. We call it *Bayar pakai cuan*.
5. **No profit? No problem.** Pay back with cash, or with a little stock, whenever you like. There is no deadline while your loan is safe.

**Safety limits.** You can borrow up to 35% of your stock's value on weekdays, and 25% on weekends (stock markets are closed). The contract checks the date itself. Nobody can change it.

**Your starting value is never touched.** Only profit above what your stock was worth when you joined is sold.

## Try it

**One screen:** open [/demo](https://www.cuanlater.xyz/demo). You see the phone, the shop terminal and the price chart side by side.

**Two screens:** open [/terminal](https://www.cuanlater.xyz/terminal) on a laptop and [/card](https://www.cuanlater.xyz/card) on your phone. Log in with your email. You don't need a wallet or any MON; we pay the network fees.

Things to try:

| Do this | What happens |
| --- | --- |
| Buy a coffee ($3.00) by card tap | Approved. You owe $3.02. Stock sold: 0. |
| Buy an es teh ($0.50) by QRIS | Approved. You owe $3.52. |
| Freeze your card, then buy a sticker ($5.00) | Declined: card frozen. Nothing charged. |
| Buy a T-shirt ($10.00) on a weekend | Declined: over today's limit. |
| Press **Start price replay** | Price goes from $40 to $44. Your $3.52 debt is paid by profit. You keep 0.9201 tNVDA ≈ $40.48. |

## Contracts (Monad testnet, chain ID 10143)

All contracts are verified (Sourcify, exact match).

| Contract | Address |
| --- | --- |
| CuanLater (the vault) | [`0xC83CF31497fe6e206B82FA35e16523Fb491774E5`](https://testnet.monadvision.com/address/0xC83CF31497fe6e206B82FA35e16523Fb491774E5) |
| MockStock (tNVDA) | [`0x6488cD402d12C14E19175ae0688349586BEe8e7A`](https://testnet.monadvision.com/address/0x6488cD402d12C14E19175ae0688349586BEe8e7A) |
| MockUSD (tUSD) | [`0x3a73d22ff7547A020296B6b162B99798Af48a4dA`](https://testnet.monadvision.com/address/0x3a73d22ff7547A020296B6b162B99798Af48a4dA) |
| Shop: Kantin Blitz | [`0xF977F34dB8a986A0A9edec3E744092c715EF793c`](https://testnet.monadvision.com/address/0xF977F34dB8a986A0A9edec3E744092c715EF793c) |

The same addresses are in [`deployments/10143.json`](deployments/10143.json).

## What's real and what's pretend

**Real**
- The contracts on Monad testnet. Every payment, decline and payback is a real on-chain transaction.
- The weekday and weekend limits.
- Email login, with network fees paid for you.

**Pretend**
- tNVDA is a demo token, not a real Nvidia share. The price is a recorded **replay**, not live.
- tUSD is a demo dollar.
- QRIS is simulated. The QR code holds a CuanLater payment link, not a real QRIS code.
- The card says **Sandbox**. There is no real Visa or Mastercard card.
- A small script (the "keeper") asks the contract to check profits every block. Anyone can do this.

## Run it on your computer

You need Node 24 and Foundry. Our contracts are already deployed, so you can skip the deploy step.

```bash
git clone https://github.com/CuanLater/CuanLater.git && cd CuanLater
cp app/.env.example app/.env.local       # fill in the Privy app ID, RPC URL and the 4 addresses above
(cd app && npm install && npm run dev)   # opens on http://localhost:3000
(cd keeper && npm install && npm run keeper)   # in a second terminal; fill keeper/.env first
```

**Deploy your own contracts (optional):**

```bash
cd contracts
cp .env.example .env                     # fill in your key and addresses
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.6.1
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
```

The deploy prints the lines to paste into `app/.env.local`. Wallets that send transactions need more than 10 MON (a Monad rule).

**Login setup (once):** in the Privy dashboard, turn on email login and smart wallets on Monad testnet, with a Pimlico paymaster to pay the fees.

## Tests

```bash
cd contracts && forge test               # 28 contract tests, all from specs/04-testing.md
node --test app/lib/format.test.ts       # money formatting
```

## Built with

| Part | Version |
| --- | --- |
| Solidity | 0.8.38 |
| Foundry | 1.8.6 |
| OpenZeppelin Contracts | 5.6.1 |
| Next.js | 16.4.3 |
| React | 19.3.1 |
| Tailwind CSS | 4.3.3 |
| Privy (email login, smart wallets) | 3.51.0 |
| Pimlico (pays network fees) | — |
| viem | 2.57.8 |
| Node | 24 |

## Notes for judges

- **When profit pays:** the keeper pays a debt only when the profit covers all of it. This sells the fewest shares. Anyone can also press **Harvest now** to pay with whatever profit there is.
- **Extras that work:** daily spending limit, pay back with stock, loan health bar. The safety sell, tap limit and operator payback are in the contract and tested, but have no screen yet.
- **Not built:** pay back in rupiah (Midtrans), mainnet.

## Team

`TODO: names`

@monad @monad_dev @geeky_kartikey
