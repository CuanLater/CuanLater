'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isAddressEqual, parseEventLogs, type Hash } from 'viem';
import { cuanLaterAbi } from '@/lib/abi';
import { publicClient, txUrl } from '@/lib/chain';
import { CUANLATER } from '@/lib/deployments';
import { blockSeconds, useBlock, useTape } from '@/lib/hooks';
import { change, shares, usd } from '@/lib/format';
import { useWallet } from '@/lib/wallet';
import { useCard, openItems } from '@/components/card-context';
import { Sparkline } from '@/components/card';
import { Button, Chip, LinkButton, Note, Row, Rows } from '@/components/ui';

type Profit = { paid: bigint; sold: bigint; price: bigint; debtAfter: bigint };

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** Board 6 · Price rises: profit pays the debt */
export default function ProfitPage() {
  const tx = useSearchParams().get('tx') as Hash | null;
  const { address, view: v } = useCard();
  const wallet = useWallet();
  const { tape, index, running } = useTape();
  const b = useBlock();
  const [p, setP] = useState<Profit | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tx) return setP(null);
    publicClient.getTransactionReceipt({ hash: tx }).then((r) => {
      const l = parseEventLogs({ abi: cuanLaterAbi, logs: r.logs, eventName: 'ProfitRepaid' }).find(
        (l) => isAddressEqual(l.address, CUANLATER) && isAddressEqual(l.args.user, address),
      );
      if (!l) return;
      setP({ paid: l.args.paid, sold: l.args.sharesSold, price: l.args.price, debtAfter: l.args.debtAfter });
      setItems(openItems.get().map((s) => s.split(':')[1].toLowerCase()));
    }, () => {});
  }, [tx, address]);

  const price = tape?.price ?? v.price;
  const secs = Number(blockSeconds(b) ?? 0);
  const perSecond = secs > 0 ? Math.round(1 / secs) : 3;
  const rate = perSecond <= 1 ? 'about once a second' : `about ${perSecond} times a second`;
  const sharesBefore = p ? v.shares + p.sold : 0n;

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-raised p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-2">tNVDA price</span>
          <Chip tone="warn">PRICE REPLAY</Chip>
        </div>
        <div className="text-3xl font-bold">{usd(price)}</div>
        <div className={`text-sm ${price >= v.entryPrice ? 'text-ok' : 'text-bad'}`}>
          {price >= v.entryPrice ? '▲' : '▼'} {change(price, v.entryPrice)} since you joined ({usd(v.entryPrice)})
        </div>
        {tape && <Sparkline points={tape.points} index={index} />}
      </section>

      {!p ? (
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm text-ink-2">
            {v.debt === 0n
              ? 'You owe $0.00. Buy something first, then watch the profit pay for it.'
              : `You owe ${usd(v.debt)}. Bayar pakai cuan pays it the moment tNVDA is above ${usd(v.entryPrice)}.`}
          </p>
          {!running && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await wallet.send('startTape').catch(() => {});
                setBusy(false);
              }}
            >
              {busy ? 'Starting…' : 'Start price replay'}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4" aria-live="polite">
          <Chip tone="ok">Debt paid by profit</Chip>
          <h1 className="text-2xl font-bold">Your profit paid your {items.length ? list(items) : 'debt'}</h1>
          <div className="flex items-baseline gap-3">
            <span className="text-ink-3 line-through">You owed {usd(p.paid + p.debtAfter)}</span>
            <span className="text-xl font-bold">You owe now {usd(p.debtAfter)}</span>
          </div>
          <Rows>
            <Row label="Profit so far" value={usd((sharesBefore * p.price) / 10n ** 18n - v.principal)} />
            <Row label="Profit used for the debt" value={`${usd(p.paid)} · ${shares(p.sold)} tNVDA`} />
            <Row label="Your stock now" value={`${shares(v.shares)} ≈ ${usd((v.shares * p.price) / 10n ** 18n)}`} />
            <Row label={`Your starting ${usd(v.principal)}`} value="Untouched" />
            {p.debtAfter === 0n && <Row label="Stock" value="Unlocked" />}
          </Rows>
          <Note tone="ok">
            The contract checks everyone&apos;s profit every block, {rate}, and pays the moment it is
            enough. Only profit is sold.
          </Note>
          {tx && (
            <a href={txUrl(tx)} target="_blank" rel="noreferrer" className="block text-sm">
              View on the explorer
            </a>
          )}
        </div>
      )}
      <LinkButton href="/card/repay">What if the price stays flat?</LinkButton>
      <LinkButton variant="ghost" href="/card">
        Back to my card
      </LinkButton>
    </div>
  );
}
