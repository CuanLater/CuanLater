import Link from 'next/link';
import { Chip, Contactless, LinkButton, Mark } from '@/components/ui';

const steps = [
  ['Tap or scan', 'Tap your Cuan Card at the shop terminal, or scan the shop QRIS. You approve on your phone.'],
  ['Borrow, not sell', 'The contract pays the shop in the same block by borrowing a little against your locked stock. Stock sold: 0.'],
  ['Profit pays', 'When the stock rises above your starting value, the profit pays the debt by itself. Checked every block.'],
];

const payback = [
  ['Profit (Bayar pakai cuan)', 'Automatic', 'Only the profit above your starting value is sold'],
  ['Cash', 'Whenever you like', 'Like paying a credit card bill'],
  ['A little stock', 'You pick the moment', 'Sells just enough tNVDA to clear the debt'],
];

const safety = [
  ['35% · 25%', 'You can borrow up to 35% of your stock on weekdays, 25% on weekends when stock markets are closed.'],
  ['50%', 'Above 50%, a safety sell brings the loan back to 35%. Never everything at once.'],
  ['≈ 85%', 'A $3.02 coffee on $40.00 of stock is only touched if the price falls about 85%.'],
  ['Freeze · Limit', 'Card controls: freeze the card from your phone, set a daily limit.'],
];

const real = [
  'Real: the contracts on Monad testnet, every payment, decline and repayment as an on-chain transaction.',
  'Real: weekend-aware limits, read from the block date by the contract itself.',
  'Real: email login with network fees paid for you.',
];
const pretend = [
  'Pretend: tNVDA is a demo token, not a real Nvidia share; prices are a recorded REPLAY.',
  'Pretend: tUSD is a demo dollar on testnet.',
  'Pretend: QRIS is simulated. The QR holds a CuanLater payment link, not a real QRIS string.',
  'Pretend: the card network badge says Sandbox. There is no real Visa or Mastercard card.',
];

const faq = [
  ['Is my stock sold when I pay?', 'No. Paying borrows against your stock. Stock is sold only to repay: from profit, when you choose to, or in a safety sell.'],
  ['Is my starting value ever touched?', 'Your starting value is never touched by Bayar pakai cuan: it only sells profit above what your stock was worth when you joined.'],
  ['Who triggers the profit check?', 'A small keeper script calls the contract every block. Anyone can call it.'],
  ['Is there a deadline?', 'No deadline while your loan is safe. There is no interest that grows over time; a 0.5% fee is added when you pay.'],
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl space-y-16 px-4 py-6">
      <nav className="flex items-center justify-between">
        <Mark />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/terminal">Shop terminal</Link>
          <Link href="/demo">Live demo</Link>
        </div>
      </nav>

      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <Chip tone="info">Monad testnet · demo</Chip>
          <h1 className="text-4xl leading-tight font-bold">Jajan pakai saham, bayar pakai cuan.</h1>
          <p className="text-ink-2">
            Cuan Card is a card backed by your stock. Tap your virtual card or scan any shop QRIS: it borrows against your
            stock instead of selling it. When the stock goes up, the profit pays the bill for you.
          </p>
          <div className="max-w-xs">
            <LinkButton href="/card">Try the demo</LinkButton>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <div className="flex h-[206px] flex-col justify-between rounded-2xl bg-card p-5 text-white shadow-xl">
            <div className="flex justify-between">
              <span className="text-lg font-bold">Cuan Card</span>
              <span className="text-[10px] text-white/70">
                Visa / MC rail <b className="block tracking-widest text-white">SANDBOX</b>
              </span>
            </div>
            <div>
              <div className="text-xs text-white/70">Available to spend today</div>
              <div className="text-3xl font-bold">$10.00</div>
            </div>
            <div className="flex justify-between text-xs">
              <span>1 tNVDA ≈ $40.00 locked</span>
              <span className="flex items-center gap-2 font-mono">
                •••• 0024 <Contactless className="size-5" />
              </span>
            </div>
          </div>
          <div className="-mt-6 ml-8 space-y-1 rounded-card border border-line bg-raised p-4 text-sm shadow">
            <div className="flex justify-between"><span>Coffee</span><b>$3.00</b></div>
            <div className="flex justify-between text-ink-2"><span>Stock sold</span><span>0 tNVDA</span></div>
            <div className="flex justify-between text-ok"><span>Paid by profit</span><span>$3.02</span></div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-card border border-line bg-raised p-5">
              <div className="text-sm font-bold text-ink-3">{i + 1}</div>
              <div className="font-semibold">{t}</div>
              <p className="text-sm text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Three ways to pay back</h2>
        <div className="overflow-x-auto rounded-card border border-line bg-raised">
          <table className="w-full text-left text-sm">
            <thead className="bg-sunken text-ink-2">
              <tr>
                <th className="p-3">How</th>
                <th className="p-3">When</th>
                <th className="p-3">What happens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payback.map((r) => (
                <tr key={r[0]}>
                  {r.map((c) => (
                    <td key={c} className="p-3">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Safety rules</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {safety.map(([n, d]) => (
            <div key={n} className="rounded-card border border-line bg-raised p-5">
              <div className="text-2xl font-bold">{n}</div>
              <p className="text-sm text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Why Monad</h2>
        <p className="text-ink-2">
          Fast blocks mean the shop gets paid in one block, about a second after you tap Approve, and the contract can
          check everyone&apos;s profit every block. Low fees make paying for a coffee on-chain sensible, and the fees are
          paid for you.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-card border border-line bg-raised p-5">
          <h2 className="text-xl font-bold">What&apos;s real</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{real.map((x) => <li key={x}>{x.replace('Real: ', '')}</li>)}</ul>
        </div>
        <div className="space-y-2 rounded-card border border-line bg-raised p-5">
          <h2 className="text-xl font-bold">What&apos;s pretend</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{pretend.map((x) => <li key={x}>{x.replace('Pretend: ', '')}</li>)}</ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">FAQ</h2>
        {faq.map(([q, a]) => (
          <details key={q} className="rounded-card border border-line bg-raised p-4">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-ink-2">{a}</p>
          </details>
        ))}
      </section>

      <section className="space-y-3 rounded-card bg-card p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Pay a coffee with your stock</h2>
        <div className="mx-auto max-w-xs">
          <LinkButton href="/card" className="bg-white! text-ink!">
            Try the demo
          </LinkButton>
        </div>
      </section>

      <footer className="pb-6 text-center text-sm text-ink-3">
        CuanLater · Built at Monad Blitz Jogja Vol. 2 · Monad testnet
      </footer>
    </div>
  );
}
