# 05 · Demo runbook

## Setup before going on stage

1. Laptop on the projector shows `/demo` at 1440 × 810 (browser full screen, zoom 100%).
2. Presenter is logged in on `/demo` with a **fresh** demo account (or run `resetAccount(presenter)` as owner, then join again). Check: available $10.00, owe $0.00.
3. Price tape reset: `resetTape()` as owner; the price strip shows $40.00 and "Start price replay" is enabled.
4. Keeper running on the laptop (`npm run keeper`), its wallet above 10 MON.
5. Pool funded (≥ $100 tUSD in the vault), shop registered, Bayar pakai cuan on.
6. Backup video (recorded at 17:45) open in another tab.
7. Say out loud at the start: repo link, contract address, live URL, "running on Monad testnet now".

## The 60 seconds

| Time | Action | What the room sees |
| --- | --- | --- |
| 0–8 s | Point at the phone | Cuan Card: 1 tNVDA ≈ $40, available today $10 (weekend) |
| 8–18 s | Terminal: Coffee $3.00, Card tap, Charge → phone: Approve | APPROVED in 1 block; click the explorer link |
| 18–26 s | Terminal: switch to QRIS, Es teh $0.50, Show QRIS → phone: simulated scan, Approve | APPROVED; Recent sales shows a Card row and a QRIS row; owe $3.52 |
| 26–34 s | Phone: Freeze; terminal: Sticker $5.00, Charge → Approve | DECLINED, card frozen; then Unfreeze |
| 34–42 s | Terminal: T-shirt $10.00 → Approve | DECLINED, over the weekend limit: would owe ≈ $13.57, $3.57 over $10.00 |
| 42–55 s | Price strip: Start price replay (or Harvest now) | Price rises to $44; debt $3.52 → $0.00; phone: "Your profit paid your coffee and es teh" |
| 55–60 s | Closing line | "Stock sold for either purchase: 0. You keep 0.9201 tNVDA ≈ $40.48, more than you started with. That took {N} blocks, about {N} seconds." |

Fill {N} from the "Last block" readout and the number of blocks between the tape reaching $44 and `ProfitRepaid`.

## If something fails

| Problem | Do this |
| --- | --- |
| Login or sponsorship hangs | Use the already-logged-in presenter session; never log in on stage |
| A payment stays pending > 5 s | Say "Monad testnet is busy", wait one more block, then switch to the backup video for that step |
| Keeper didn't harvest | Press Harvest now |
| Tape already at $44 | `resetTape()` from the owner script, then Start price replay |
| Explorer slow | Show the tx hash on the terminal and move on |

## Reset between rehearsals

```
cast send $CUANLATER "resetTape()" --private-key $OWNER_KEY --rpc-url $RPC_URL
cast send $CUANLATER "resetAccount(address)" $PRESENTER --private-key $OWNER_KEY --rpc-url $RPC_URL
```

Then rejoin on `/demo`. Rehearse the full 60 seconds twice in a row before the freeze.

## Judging checklist (Basic + Advance = 300 points)

- [ ] Public GitHub repo
- [ ] README with live URL and contract addresses
- [ ] Contracts on Monad testnet
- [ ] Publicly hosted (Vercel)
- [ ] Every announced function works (Must rows only, plus Bonus rows that pass)
- [ ] Live on-chain transaction during the demo (step 2, explorer link on screen)
- [ ] Contracts verified on the explorer
- [ ] Someone else ran it from the README
- [ ] Post on X or LinkedIn tagging @monad @monad_dev @geeky_kartikey
- [ ] Demo video 30 s+ showing the product running
- [ ] Creative ad video
- [ ] 5K+ views across posts

Bonus (up to 100): mainnet deploy (25), custom domain (15), product-market fit (20), revenue story (20), originality (20). Use only the claims allowed in `00-overview.md`.
