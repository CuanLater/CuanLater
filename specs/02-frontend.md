# 02 · Frontend

One Next.js 16.4.3 app (App Router, React 19.3.1, TypeScript, Tailwind CSS 4.3.3), hosted on Vercel. The design source is the **CuanLater flow mockups** canvas; each screen below names its mockup board. Visual tokens come from the Onchain Kit Base design system (`okb.css`: copy it into `app/styles/okb.css` and map the CSS variables into the Tailwind theme). Fonts: Inter (UI), JetBrains Mono (numbers like •••• 0024, hashes).

## Routes

| Route | Surface | Mockup boards |
| --- | --- | --- |
| `/` | Landing page | Landing page |
| `/card` | Phone app: join, then home | 1 · Join, 2 · Cuan Card home |
| `/card/pay` | Payment request sheet (card or QRIS) | 3 · Shop asks, you approve; 3b · QRIS request |
| `/card/result/[orderId]` | Approved or declined | 4 · Approved; 4b · Approved via QRIS; 5 · Declined: weekend limit; 5b · Declined: card frozen |
| `/card/profit` | Profit paid the debt | 6 · Price rises: profit pays the debt |
| `/card/repay` | Pay back yourself | 7 · No profit: pay back yourself |
| `/card/safety` | Big crash explainer (static example) | 8 · Big crash: safety sell |
| `/terminal` | Shop terminal (laptop) | Shop terminal: card tap; QRIS dynamic QR; approved |
| `/demo` | Projector layout: phone + terminal + price strip on one screen | Live demo layout |

The phone routes are designed at 390 × 844 and must work at 360 px wide.

## Shared modules (`app/lib`)

| Module | Contents |
| --- | --- |
| `constants.ts` | Values from `00-overview.md` (bps, fee, FX 16_000, items, shop name, NMID label) |
| `chain.ts` | Monad testnet chain object for viem/wagmi, RPC URLs (primary + fallback), explorer base URL |
| `abi.ts` | Generated from Foundry `out/` (CuanLater, MockUSD) |
| `deployments.ts` | Reads `deployments/10143.json` |
| `format.ts` | Money, shares, rupiah, percent (rules below) |
| `rails.ts` | `Rail` enum mirrored from the contract: `CARD = 0`, `QRIS = 1`; labels |
| `requests.ts` | `PaymentRequest` type, `newOrderId()`, URL encode/decode, BroadcastChannel helpers |
| `reasons.ts` | Decline `Reason` enum → copy (table below) |

## Formatting rules

- Money owed or charged (debt, fee, "would owe", "over by"): round **half-up** to cents. `$3.015` → `$3.02`; `$3.5175` → `$3.52`; `$13.5675` → `$13.57`.
- Money you can still spend (available today, borrowing left): round **down** to cents. `$6.985` → `$6.98`; `$6.4825` → `$6.48`.
- Stock value: round half-up. 0.92006 × $44 = `$40.48`.
- Shares: 4 decimals, `1.0000 tNVDA` (show `1 tNVDA` only on the card face).
- Rupiah: `amount × 16_000`, formatted `id-ID` with no decimals and "Rp" prefix, always with "≈": `≈ Rp 48.000`.
- Percent from bps: one decimal (`8.8%`), price change two decimals (`+10.00%`).

## Payment request and messaging

```ts
type PaymentRequest = {
  orderId: `0x${string}`;     // 32 random bytes, hex; passed to tryPay
  shop: `0x${string}`;        // Kantin Blitz address
  shopName: 'Kantin Blitz';
  item: 'coffee' | 'es-teh' | 'sticker' | 't-shirt' | 'custom';
  itemLabel: string;          // "Coffee", "Es teh", ...
  amount: string;             // tUSD base units (6 dec), e.g. "500000"
  rail: 'card' | 'qris';
  createdAt: number;          // ms
};
```

How the request reaches the phone:

1. **Same screen (`/demo`):** shared React state. The terminal half sets the request and the phone half opens the sheet immediately.
2. **Two tabs on one laptop:** `BroadcastChannel('cuanlater')`, message `{ type: 'request', request }` and `{ type: 'cancel', orderId }`.
3. **Separate devices (a judge trying it):** the request as a URL. In QRIS mode the QR encodes it, so a phone camera opens the request directly:
   `https://<host>/card/pay?o=<orderId>&s=<shop>&a=<amount>&i=<item>&r=qris&c=10143`
   For card tap on a separate device, the phone's "Tap card at Kantin Blitz" button opens the item picker (Coffee, Es teh, Sticker, T-shirt) when no request has arrived.

Use an `https` URL in the QR, not the `cuanlater:` scheme drawn in the mockup, so any camera app opens it. Validate every incoming request with zod (amount is digits only, shop is a registered address, rail is `card` or `qris`).

## Screens

Copy in quotes is exact. `{x}` are live values.

### `/card` · Join (board 1)

- Header: CuanLater mark, "Testnet demo" badge.
- Title "Buy with your stock. Keep your stock."; sub "Tap to pay at a shop by borrowing a little against your stock. If the stock goes up, the profit pays the debt for you."
- "You will get" card: "1.0000 tNVDA ≈ $40.00", lock line "Locked as your guarantee. You keep all of it."
- Steps: "The shop charges, you tap Approve." / "Your stock is not sold. You owe a small debt instead." / "When the stock rises, the profit pays the debt. No profit? Pay back like a credit card."
- Email field + primary "Continue with email" (Privy email OTP). After login, if `!accountView.joined` call `join()` automatically, then show home.
- Footer: "No app or wallet needed. Network fees are paid for you. Demo tokens on Monad testnet; prices are a replay."

### `/card` · Cuan Card home (board 2)

- Header badge: weekend → "Saturday · weekend limit" (use the real weekday name); weekday → "{Weekday} · weekday limit".
- **Card face** (dark `#17171C`, ~206 px tall): "Cuan Card"; pills "QRIS ready" and "TESTNET"; "Available to spend today" `{availableOf}`; "{limitBps/100}% of your stock · {weekend|weekday} limit"; right-side badge "Visa / MC rail" over "SANDBOX"; bottom "{shares} tNVDA ≈ {value} locked", "•••• {last4}", contactless icon. `last4` = 4 digits derived from the wallet address (e.g. `BigInt(addr) % 10000n`, zero-padded).
- Tiles: "You owe" `{debt}` with "No deadline while safe"; "Loan health" with label and 3-part bar (Safe < 35% ≤ Careful ≤ 50% < Auto-sell).
- Controls list: "Bayar pakai cuan" switch → `setAutoRepay`; "Freeze card" row (Off/On) → `freeze()` / `unfreeze()`; "Daily limit" row with "Set" → sheet with an amount input → `setDailyLimit` (hide the row if R9 is not built).
- Link "Pay back or top up" → `/card/repay`.
- Buttons: primary "Tap card at Kantin Blitz" → open the pending card request, else item picker; outlined "Pay via QRIS (simulated)" → QRIS request view for the pending request, else item picker with rail = QRIS.
- When frozen, the card face turns grey with a "FROZEN" pill and the available amount reads "$0.00 while frozen".

### `/card/pay` · Payment request (boards 3, 3b)

Common rows (identical for both rails):
- "Borrowed against your stock" `≈ {amount + fee}` with sub "Includes 0.5% fee"
- "Stock sold" "0 tNVDA"
- "You will owe" (card) or "You will owe in total" (QRIS) `{debt + amount + fee}`
- "Borrowing left today" `{available − amount − fee}`, floored

Card rail: badge "Paid via Cuan Card Visa •••• {last4}"; "Kantin Blitz asks for" `{amount}`; "{Item} · card tap"; recipient card with "Verified shop" chip and the shop address in groups of 4; info note "Your 1 tNVDA stays locked, not sold. Pay the {owe} back later: from profit, with cash, or with a little stock. No deadline while your loan is safe."; primary "Approve {amount} card tap"; secondary "Decline".

QRIS rail: header badge "Simulated scan"; badge "Scanned via QRIS · Kantin Blitz"; a dark viewfinder (~170 px) showing the request QR inside green corner brackets for 1 s (CSS animation, no camera), caption "Simulated scan · 1 s"; then the green check line "QRIS merchant verified: Kantin Blitz ({amount} / ≈ Rp {idr})"; "Kantin Blitz asks for" `{amount}`; "{Item} · ≈ Rp {idr}"; primary "Approve {amount} via QRIS"; text link "Decline".

**Approve** (both rails): call `tryPay(shop, amount, rail, orderId)` through the Privy smart wallet (gas sponsored). Show a pending state on the button ("Paying…"). Start a timer at tap; stop at receipt. Then route to `/card/result/[orderId]`. Also broadcast `{ type: 'sent', orderId, txHash }`.

Before sending, run the same checks locally from `accountView` so an obvious decline still sends `tryPay` (the decline must be on-chain) but the UI is ready to show it.

### `/card/result/[orderId]` (boards 4, 4b, 5, 5b)

Read the receipt's `Paid` or `Declined` log for this `orderId`.

**Approved:** chips "Approved" + rail chip ("Card •••• {last4}" or "QRIS · Kantin Blitz"); title "Paid {amount} at Kantin Blitz"; sub "Cuan Card · confirmed in 1 block, about {seconds} seconds." (QRIS: "Scanned via QRIS · confirmed in …"), using the measured time; "View on the explorer" link (tx hash); rows "Stock sold 0 tNVDA", "You owe {debt}", "Your stock {shares} ≈ {value}", "Borrowing left today {available}"; note "Bayar pakai cuan is on. When tNVDA rises above your starting price of {entryPrice}, the profit pays this {debt} by itself. Checked every block." Buttons per demo order: after a card-tap coffee, primary "Next: es teh by QRIS ($0.50)"; after QRIS, primary "Watch the price replay" (→ `/card/profit` once the tape runs) and secondary "Try buying a T-shirt ($10.00)".

**Declined** (reason → screen):

| Reason | Title | Body / rows |
| --- | --- | --- |
| `OVER_WEEKEND_LIMIT` | "This {item} is over today's limit" | "Today is {Weekday} and the stock market is closed, so you can borrow up to 25% of your stock's value. Nothing was charged." Rows: "Your stock ≈ {value}", "Limit today (25%) {limit}", "You already owe {debt}", "{Item} plus fee ≈ {amount+fee}", "You would owe ≈ {wouldOwe} · over by {wouldOwe − limit}". Note: "On weekdays the limit is 35% ({value × 0.35}). The contract reads today's date itself; nobody can switch it, not even us." Buttons "Back to menu", "Pay back {debt} first". |
| `OVER_WEEKDAY_LIMIT` | Same, with 35% and no market-closed sentence | |
| `FROZEN` | "{Item} {amount} declined: card frozen" | Grey frozen card face; "You froze your card before this payment, so the contract refused it. Nothing was charged and your stock stays locked and safe." Rows: "New payments Blocked", "Bayar pakai cuan Still on", "Paying back Still allowed", "Who can unfreeze Only you". Buttons "Unfreeze card", "Keep it frozen". |
| `OVER_DAILY_LIMIT` | "Over your daily limit" | "You set {dailyLimit} a day. Spent today: {spent}." |
| `POOL_EMPTY` | "The shop can't be paid right now" | "Nothing was charged. Try again in a minute." |
| `UNKNOWN_SHOP` | "This shop isn't registered" | |

### `/card/profit` (board 6)

Shown automatically when a `ProfitRepaid` event for the user arrives (watch events), or from the result screen.
- Price card: "tNVDA price", "PRICE REPLAY" pill, `{price}`, "▲ +{pct}% since you joined ({entryPrice})", sparkline of the tape.
- Chip "Debt paid by profit"; title "Your profit paid your coffee and es teh" (build the list from the items paid since the last zero-debt moment; one item → "Your profit paid your {item}").
- "You owed {before}" struck through → "You owe now $0.00".
- Rows: "Profit so far {value_before − principal}", "Profit used for the debt {paid} · {sold} tNVDA", "Your stock now {shares} ≈ {value}", "Your starting {principal} Untouched", "Stock Unlocked" (debt 0).
- Note "The contract checks everyone's profit every block, about 3 times a second, and pays the moment it is enough. Only profit is sold." Replace "about 3 times a second" with the measured block rate if it differs.
- Primary "What if the price stays flat?" → `/card/repay`.

### `/card/repay` (board 7)

- Header price pill "tNVDA {price} · {pct} · replay".
- Title "You owe {debt}"; "No profit yet, so pay back whenever you like. There is no deadline while your loan is safe."
- Health bar with marker at `health / 70%` of the bar width, label "Safe · debt is {health}% of stock".
- Options: 1 "Pay with cash" ("Like paying a credit card bill. Cash balance: {tUSD balance}") → primary "Pay {debt} with cash" → `repay(debt)`; optional link "Or pay in rupiah with GoPay or QRIS" + "SANDBOX" tag (R15, hide if not built). 2 "Pay with a little stock" ("Sells ≈ {shares} tNVDA ({debt}). You pick the moment, not the café.") → `repayWithStock()` (R10, hide if not built). 3 "Just wait".
- Footer: "Top up $10 (pretend salary)" → `topUp()`; link "What if it crashes?" → `/card/safety`.

### `/card/safety` (board 8)

Static explainer with the Budi example: borrowed $10.00 on $40.00, price $22.00 (−45%), debt 45.7% "Careful", "Auto-sell starts below ≈ $20.10 of stock", "At 50%, the app sells just enough stock to make the loan safe again. Never everything at once.", coffee note "A coffee is very safe: $3.02 owed on $40.00 of stock is only touched if the price falls about 85%." Buttons "Pay some back to stay safe", "Start over".

### `/terminal` (boards: card tap, QRIS, approved)

- Header: shop icon, "Kantin Blitz", "Shop terminal · accepts Cuan Card", pill "Monad testnet · demo dollars".
- Left panel: "Amount" `{amount}`; preset chips Coffee $3.00, Es teh $0.50, Sticker $5.00, T-shirt $10.00; keypad 1–9, ".", 0, ⌫; rail switch (tabs) "Card tap (Visa / MC)" | "QRIS dynamic QR"; primary "Charge {amount}" (card) or "Show QRIS for {amount}" (QRIS).
- Right panel, card mode: chip "Ready to charge"; contactless circle; "Tap Cuan Card"; "Press Charge and the request pops up on the customer's phone. One tap approves it and you receive {amount} in the same block. No QR, no camera."
- Right panel, QRIS mode: standee card with dark angled header "QRIS · SANDBOX DEMO", "KANTIN BLITZ · NMID: ID102026MONAD", the request QR (render with a QR library from the request URL), "{amount} (≈ Rp {idr}) · {Item}", pill "Sandbox · not a real QRIS code", dark angled footer; helper "Customer can scan this QRIS or tap \"Pay via QRIS (simulated)\" on the phone to execute the on-chain payment in 1 Monad block."; chip "Waiting for the scan".
- On Charge / Show QRIS: create the request, broadcast it, set status "Waiting for the customer to approve". Watch logs for `Paid` / `Declined` with this `orderId` (poll `getLogs` every 500 ms, indexed topic).
- **Approved view:** green panel "APPROVED", `{amount}`, "{Item} · paid by Cuan Card •••• {last4}", chips "Confirmed in 1 block · {seconds} s", "Customer's stock sold: 0", "Rail: card tap|QRIS", link "View transaction on the explorer". Short success sound. Declined view: same layout in red "DECLINED" with the reason line.
- **Recent sales** (right column on the approved view): last 6 `Paid`/`Declined` logs for this shop, newest first. Each row: "{Item} · {amount}" + rail chip ("Card •••• {last4}" or "QRIS"); sub "Confirmed in 1 block · View on explorer" for approved, or the decline reason + "· nothing charged"; status chip Approved/Declined. Footer "Received today {sum of Paid amounts today}"; primary "New sale". Item labels come from a local map `orderId → item` (the chain only knows amounts); unknown orders show "Payment".

### `/demo` (Live demo layout, 1440 × 810 projector)

- Header: "CuanLater · live demo"; step pills "1 Shop charges", "2 You approve", "3 Approved on Monad", "4 Profit pays" (highlight follows state); amber pill "{Weekday} · weekend limit 25%" (or weekday 35%); "Monad testnet".
- Left: phone frame (~330 px) running the real `/card` components (logged-in presenter account).
- Right top: compact terminal (Kantin Blitz, `{amount}`, item, status chip, rows "Rail", "You receive {amount}, same block", "Last block {measured} s", "Cancel sale").
- Right bottom: **price strip**: "REPLAY" pill, `{price}`, "+{pct}% since start", "tNVDA · start $40.00", the full tape drawn as a line with a dot at the current index, "Coffee + es teh {openDebt} → $0.00" (live open debt of the presenter), buttons "Start price replay" (`startTape()`, disabled while running) and "Harvest now" (`harvestRange(0, membersLength)`).
- "Last block" = average interval of the last 10 block timestamps from `watchBlocks`; show one decimal.

### `/` Landing page

Sections as in the Landing board: nav; hero (sub-copy "Cuan Card is a card backed by your stock. Tap your virtual card or scan any shop QRIS: it borrows against your stock instead of selling it. When the stock goes up, the profit pays the bill for you."; tagline "Jajan pakai saham, bayar pakai cuan."; card visual + example coffee stack); How it works (3 steps); payback table; safety rules (35%·25%, 50%, ≈85%, Card controls: Freeze · Limit); why Monad; "What's real and what's pretend" (lists from the board, including the simulated QRIS line and the card-network line); FAQ; CTA "Try the demo" → `/card`; footer "CuanLater · Built at Monad Blitz Jogja Vol. 2 · Monad testnet".

## Data and state

- Wallet and login: Privy (`@privy-io/react-auth` 3.51.0 with smart wallets) + `@privy-io/wagmi` 4.0.19 + wagmi 3.7.9 + TanStack Query 5.104.5. Use the smart-wallet client to send every write so gas is sponsored.
- Reads: one `accountView(user)` call, refetched when a new block arrives (throttle to once per 500 ms). `price()` and `isWeekend()` come from the same struct.
- Events: `watchContractEvent` for `Paid`, `Declined`, `ProfitRepaid`, `Repaid` filtered by user (phone) or shop (terminal), with a `getLogs` poll fallback.
- Explorer links: `${EXPLORER_URL}/tx/${hash}`.
- No server state for payments. The only server code is the optional Midtrans route.

## Accessibility and quality bar

- Tap targets ≥ 44 px; one primary button per view; links underlined; numbers tabular.
- Every icon-only control has an `aria-label`; status changes (APPROVED/DECLINED) are announced with `aria-live="polite"`.
- No emoji, no brand logos (see claim rules in `00-overview.md`).
- Works in light mode; dark mode optional.
