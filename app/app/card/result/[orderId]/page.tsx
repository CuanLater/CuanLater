'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { isAddressEqual, parseEventLogs, type Hash } from 'viem';
import { cuanLaterAbi } from '@/lib/abi';
import { publicClient, txUrl } from '@/lib/chain';
import { CUANLATER } from '@/lib/deployments';
import { ITEMS, fee, itemLabel } from '@/lib/constants';
import { last4, shares, usd, usdDown, weekdayName } from '@/lib/format';
import { Rail } from '@/lib/rails';
import { Reason } from '@/lib/reasons';
import { newRequest, requestQuery } from '@/lib/requests';
import { useWallet } from '@/lib/wallet';
import { useCard, openItems } from '@/components/card-context';
import { CardFace } from '@/components/card';
import { Button, Chip, LinkButton, Note, Row, Rows } from '@/components/ui';

type Outcome =
  | { ok: true; amount: bigint; fee: bigint; debtAfter: bigint; rail: Rail }
  | { ok: false; amount: bigint; rail: Rail; reason: Reason; a: bigint; b: bigint };

/** Boards 4, 4b, 5, 5b */
export default function Result() {
  const { orderId } = useParams<{ orderId: string }>();
  const q = useSearchParams();
  const tx = q.get('tx') as Hash | null;
  const ms = Number(q.get('ms') ?? 0);
  const item = q.get('i') ?? 'custom';
  const label = itemLabel(item);
  const { address, view: v, refresh } = useCard();
  const wallet = useWallet();
  const router = useRouter();
  const [out, setOut] = useState<Outcome | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tx) return setError('No transaction for this payment.');
    publicClient.getTransactionReceipt({ hash: tx }).then((r) => {
      const logs = parseEventLogs({ abi: cuanLaterAbi, logs: r.logs, eventName: ['Paid', 'Declined'] }).filter(
        (l) => isAddressEqual(l.address, CUANLATER) && l.args.orderId === orderId,
      );
      const l = logs[0];
      if (!l) return setError('This transaction has no result for this order.');
      if (l.eventName === 'Paid') {
        // debt was $0 before this payment → start a new list of items for the profit screen
        const fresh = l.args.debtAfter === l.args.amount + l.args.fee;
        const items = fresh ? [] : openItems.get();
        if (!items.includes(`${orderId}:${label}`)) openItems.set([...items, `${orderId}:${label}`]);
        setOut({ ok: true, amount: l.args.amount, fee: l.args.fee, debtAfter: l.args.debtAfter, rail: l.args.rail });
      } else {
        setOut({ ok: false, amount: l.args.amount, rail: l.args.rail, reason: l.args.reason, a: l.args.a, b: l.args.b });
      }
    }, (e) => setError(e.shortMessage ?? 'Could not read the transaction.'));
  }, [tx, orderId, label]);

  if (error) return <p className="pt-10 text-center text-sm text-bad">{error}</p>;
  if (!out) return <p className="pt-10 text-center text-sm text-ink-2" aria-live="polite">Reading the result…</p>;

  const pay = (k: keyof typeof ITEMS, rail: 'card' | 'qris') =>
    router.push(`/card/pay?${requestQuery(newRequest(k, ITEMS[k].amount, rail))}`);
  const explorer = tx && (
    <a href={txUrl(tx)} target="_blank" rel="noreferrer" className="text-sm">
      View on the explorer
    </a>
  );

  if (out.ok) {
    const qris = out.rail === Rail.QRIS;
    const secs = ms ? (ms / 1000).toFixed(1) : null;
    return (
      <div className="space-y-4" aria-live="polite">
        <div className="flex gap-2">
          <Chip tone="ok">Approved</Chip>
          <Chip>{qris ? 'QRIS · Kantin Blitz' : `Card •••• ${last4(address)}`}</Chip>
        </div>
        <h1 className="text-2xl font-bold">Paid {usd(out.amount)} at Kantin Blitz</h1>
        <p className="text-sm text-ink-2">
          {qris ? 'Scanned via QRIS' : 'Cuan Card'} · confirmed in 1 block{secs ? `, about ${secs} seconds` : ''}.
        </p>
        {explorer}
        <Rows>
          <Row label="Stock sold" value="0 tNVDA" />
          <Row label="You owe" value={usd(v.debt)} />
          <Row label="Your stock" value={`${shares(v.shares)} ≈ ${usd(v.value)}`} />
          <Row label="Borrowing left today" value={usdDown(v.available)} />
        </Rows>
        {v.autoRepay && (
          <Note tone="ok">
            Bayar pakai cuan is on. When tNVDA rises above your starting price of {usd(v.entryPrice)}, the profit pays this{' '}
            {usd(v.debt)} by itself. Checked every block.
          </Note>
        )}
        <div className="space-y-2">
          {!qris ? (
            <>
              <Button onClick={() => pay('es-teh', 'qris')}>Next: es teh by QRIS ($0.50)</Button>
              <LinkButton variant="secondary" href="/card">
                Back to my card
              </LinkButton>
            </>
          ) : (
            <>
              <LinkButton href="/card/profit">Watch the price replay</LinkButton>
              <Button variant="secondary" onClick={() => pay('t-shirt', 'card')}>
                Try buying a T-shirt ($10.00)
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const declinedChip = <Chip tone="bad">Declined</Chip>;
  const nothing = 'Nothing was charged.';

  if (out.reason === Reason.OVER_WEEKEND_LIMIT || out.reason === Reason.OVER_WEEKDAY_LIMIT) {
    const weekend = out.reason === Reason.OVER_WEEKEND_LIMIT;
    const bps = weekend ? 2500n : 3500n;
    const value = (out.b * 10_000n) / bps;
    const owedBefore = out.a - out.amount - fee(out.amount);
    return (
      <div className="space-y-4" aria-live="polite">
        {declinedChip}
        <h1 className="text-2xl font-bold">This {label.toLowerCase()} is over today&apos;s limit</h1>
        <p className="text-sm text-ink-2">
          {weekend
            ? `Today is ${weekdayName(Date.now() / 1000)} and the stock market is closed, so you can borrow up to 25% of your stock's value. ${nothing}`
            : `Today you can borrow up to 35% of your stock's value. ${nothing}`}
        </p>
        <Rows>
          <Row label="Your stock" value={`≈ ${usd(value)}`} />
          <Row label={`Limit today (${weekend ? 25 : 35}%)`} value={usd(out.b)} />
          <Row label="You already owe" value={usd(owedBefore)} />
          <Row label={`${label} plus fee`} value={`≈ ${usd(out.amount + fee(out.amount))}`} />
          <Row label="You would owe" value={`≈ ${usd(out.a)} · over by ${usd(out.a - out.b)}`} />
        </Rows>
        {weekend && (
          <Note>
            On weekdays the limit is 35% ({usd((value * 3500n) / 10_000n)}). The contract reads today&apos;s date itself;
            nobody can switch it, not even us.
          </Note>
        )}
        {explorer}
        <div className="space-y-2">
          <LinkButton href="/card">Back to menu</LinkButton>
          <LinkButton variant="secondary" href="/card/repay">
            Pay back {usd(v.debt)} first
          </LinkButton>
        </div>
      </div>
    );
  }

  if (out.reason === Reason.FROZEN) {
    return (
      <div className="space-y-4" aria-live="polite">
        {declinedChip}
        <h1 className="text-2xl font-bold">
          {label} {usd(out.amount)} declined: card frozen
        </h1>
        <CardFace v={{ ...v, frozen: true }} address={address} />
        <p className="text-sm text-ink-2">
          You froze your card before this payment, so the contract refused it. Nothing was charged and your stock stays
          locked and safe.
        </p>
        <Rows>
          <Row label="New payments" value="Blocked" />
          <Row label="Bayar pakai cuan" value="Still on" />
          <Row label="Paying back" value="Still allowed" />
          <Row label="Who can unfreeze" value="Only you" />
        </Rows>
        {explorer}
        <div className="space-y-2">
          <Button
            onClick={async () => {
              await wallet.send('unfreeze');
              await refresh();
              router.push('/card');
            }}
          >
            Unfreeze card
          </Button>
          <LinkButton variant="secondary" href="/card">
            Keep it frozen
          </LinkButton>
        </div>
      </div>
    );
  }

  const simple: Partial<Record<Reason, [string, string]>> = {
    [Reason.OVER_DAILY_LIMIT]: [
      'Over your daily limit',
      `You set ${usd(out.b)} a day. Spent today: ${usd(out.a - out.amount)}.`,
    ],
    [Reason.POOL_EMPTY]: ["The shop can't be paid right now", 'Nothing was charged. Try again in a minute.'],
    [Reason.UNKNOWN_SHOP]: ["This shop isn't registered", nothing],
  };
  const [title, body] = simple[out.reason] ?? ['Payment declined', nothing];
  return (
    <div className="space-y-4" aria-live="polite">
      {declinedChip}
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-ink-2">{body}</p>
      {explorer}
      <LinkButton href="/card">Back to menu</LinkButton>
    </div>
  );
}
