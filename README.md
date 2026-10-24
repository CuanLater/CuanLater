# CuanLater · Cuan Card

**Jajan pakai saham, bayar pakai cuan.** Pay at a shop with a virtual card backed by your stock, and let the stock's profit pay the bill.

In 20 seconds: you lock 1 tNVDA (≈ $40). When you tap Cuan Card at a shop (or scan its QRIS), the contract pays the shop in the same block by **borrowing** a little against your stock. Stock sold: 0. When tNVDA rises above where you started, **the profit pays the debt automatically**, checked every block ("Bayar pakai cuan"). How much you can borrow depends on the day: 35% of your stock on weekdays, 25% on weekends when stock markets are closed. The contract reads the date itself.

Built at Monad Blitz Jogja Vol. 2, on Monad testnet.

## Live

- App: `TODO: Vercel URL`
- Demo video (30 s+): `TODO: link`

## Contracts (Monad testnet, chain 10143)

| Contract | Address |
| --- | --- |
| CuanLater | [`0xC83CF31497fe6e206B82FA35e16523Fb491774E5`](https://testnet.monadvision.com/address/0xC83CF31497fe6e206B82FA35e16523Fb491774E5) |
| MockStock (tNVDA) | [`0x6488cD402d12C14E19175ae0688349586BEe8e7A`](https://testnet.monadvision.com/address/0x6488cD402d12C14E19175ae0688349586BEe8e7A) |
| MockUSD (tUSD) | [`0x3a73d22ff7547A020296B6b162B99798Af48a4dA`](https://testnet.monadvision.com/address/0x3a73d22ff7547A020296B6b162B99798Af48a4dA) |
| Shop (Kantin Blitz) | `0xF977F34dB8a986A0A9edec3E744092c715EF793c` |

All three contracts are verified on Sourcify (exact match), shown on MonadVision. The tape step is 5 blocks (Monad testnet ≈ 0.31 s per block, so the rise takes ≈ 14 s).

Addresses are also written to `deployments/10143.json` by the deploy script.

## Run it yourself

Needs Node 24 and Foundry. To use our deployed contracts, skip step 3 and paste the addresses above into `app/.env.local`.

```bash
git clone <this repo> cuanlater && cd cuanlater
cp app/.env.example app/.env.local   # fill NEXT_PUBLIC_PRIVY_APP_ID, RPC URL and the 4 addresses
(cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.6.1 && forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast)
(cd app && npm i && npm run dev)
(cd keeper && npm i && npm run keeper)   # second terminal; needs keeper/.env (see keeper/.env.example)
```

The deploy script needs `PRIVATE_KEY`, `TREASURY_ADDRESS`, `OPERATOR_ADDRESS`, `SHOP_ADDRESS` (see `contracts/.env.example`) and prints the `NEXT_PUBLIC_*` lines to paste. Every wallet that sends value (deployer, keeper) must hold more than 10 MON.

**Privy setup (once):** in the Privy dashboard enable email login, smart wallets on Monad testnet, and a Pimlico paymaster for gas sponsorship. Users never hold MON.

**Without Privy (local only):** leave `NEXT_PUBLIC_PRIVY_APP_ID` empty and run against `anvil --block-time 1` with `NEXT_PUBLIC_CHAIN_ID=31337`. The app then uses a burner key in the browser and funds it on anvil.

### Tests

```bash
cd contracts && forge test
```

T1–T26 from `specs/04-testing.md` (plus helpers), including a fuzz test. Money formatting is checked with `node --test app/lib/format.test.ts`.

### Rehearsal reset

```bash
cast send $CUANLATER "resetTape()" --private-key $OWNER_KEY --rpc-url $RPC_URL
cast send $CUANLATER "resetAccount(address)" $PRESENTER --private-key $OWNER_KEY --rpc-url $RPC_URL
```

## How to try it

- Open `/terminal` on a laptop and `/card` on a phone. Press **Charge** on the terminal; if both are in the same browser the request pops up on the phone. On another device, switch the terminal to **QRIS dynamic QR** and scan it with the phone camera.
- Or open `/demo` on one screen: phone, terminal and the price replay side by side.
- Try: coffee by card ($3.00), es teh by QRIS ($0.50), freeze the card and buy a sticker, try a T-shirt ($10.00, over the weekend limit), then **Start price replay** and watch the profit pay the debt.

## What's real and what's pretend

Real:
- The contracts on Monad testnet; every payment, decline and repayment is an on-chain transaction.
- Weekend-aware limits, read from the block date by the contract.
- Email login with network fees paid for you.

Pretend:
- tNVDA is a demo token, not a real Nvidia share. Prices are a recorded REPLAY, not a live feed.
- tUSD is a demo dollar on testnet.
- QRIS is simulated. The QR holds a CuanLater payment link, not a real QRIS string ("Sandbox · not a real QRIS code").
- The card network badge says Sandbox. There is no real Visa or Mastercard card.
- A keeper script triggers the profit check every block; anyone can call it.

Your starting value is never touched: Bayar pakai cuan only sells profit above what your stock was worth when you joined.

## Tech stack

| Part | Version |
| --- | --- |
| Solidity | 0.8.38 |
| Foundry | v1.8.6 (tested with 1.7.1) |
| OpenZeppelin Contracts | 5.6.1 |
| Next.js (App Router) | 16.4.3 |
| React | 19.3.1 |
| Tailwind CSS | 4.3.3 |
| @privy-io/react-auth (smart wallets) | 3.51.0 |
| permissionless | 0.2.57 |
| viem | 2.57.8 |
| zod | 4.6.7 |
| Node | 24 |

## Notes for reviewers

- **Keeper rule:** the keeper harvests a user only when their profit covers the whole debt ("pays the moment it is enough"). Harvesting at every small tape step would sell shares at lower prices and leave less stock. The contract's `harvestMany` / `harvestRange` still pay partially when called directly (the **Harvest now** button).
- Bonus items built in the contract and tested: daily limit (R9), stock repay (R10), safety sell (R11), health bar (R12), tap limit (R16), `repayFor` (R15). App UI covers R9, R10, R12. Midtrans (R15 app side) and mainnet (R14) are not built.

## Team

`TODO: names`

@monad @monad_dev @geeky_kartikey
