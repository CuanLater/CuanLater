'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getAbiItem, pad, parseEventLogs, toEventSelector, toHex, type Address, type Hash, type Hex, type Log } from 'viem';
import { cuanLaterAbi } from '@/lib/abi';
import { publicClient, txUrl } from '@/lib/chain';
import { CUANLATER, SHOP } from '@/lib/deployments';
import { ITEMS, itemLabel, type ItemKey } from '@/lib/constants';
import { idrPlain, last4, parseUsd, usd } from '@/lib/format';
import { Rail } from '@/lib/rails';
import { Reason, reasonLine } from '@/lib/reasons';
import { newRequest, post, requestUrl, subscribe, type PaymentRequest } from '@/lib/requests';
import { blockSeconds, store, useBlock } from '@/lib/hooks';
import { Button, Chip, Contactless } from './ui';

export type Sale = {
  orderId: Hex;
  ok: boolean;
  amount: string;
  user: Address;
  rail: Rail;
  reason: Reason;
  tx: Hash;
  block: string;
  at: number;
};

const sales = store<Sale[]>('cuanlater.sales', []);
const itemsByOrder = store<Record<string, ItemKey>>('cuanlater.items', {});
const topics = [toEventSelector(getAbiItem({ abi: cuanLaterAbi, name: 'Paid' })), toEventSelector(getAbiItem({ abi: cuanLaterAbi, name: 'Declined' }))];
const MAX_RANGE = 100n; // keep getLogs ranges small for the public RPC

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {}
}

export const saleItem = (orderId: string) => itemLabel(itemsByOrder.get()[orderId] ?? 'custom');

export function useTerminal() {
  const [amountStr, setAmountStr] = useState('3.00');
  const [item, setItem] = useState<ItemKey>('coffee');
  const [rail, setRail] = useState<'card' | 'qris'>('card');
  const [req, setReq] = useState<PaymentRequest | null>(null);
  const [result, setResult] = useState<Sale | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [list, setList] = useState<Sale[]>([]);
  const b = useBlock();
  const latest = useRef<bigint | null>(null);
  const cursor = useRef<bigint | null>(null);
  const reqRef = useRef<PaymentRequest | null>(null);
  latest.current = b?.number ?? null;
  reqRef.current = req;

  const amount = parseUsd(amountStr);

  const record = useCallback((logs: Log[]) => {
    const parsed = parseEventLogs({ abi: cuanLaterAbi, logs, eventName: ['Paid', 'Declined'] });
    if (!parsed.length) return;
    const known = sales.get();
    for (const l of parsed) {
      if (known.some((s) => s.tx === l.transactionHash && s.orderId === l.args.orderId)) continue;
      known.push({
        orderId: l.args.orderId,
        ok: l.eventName === 'Paid',
        amount: l.args.amount.toString(),
        user: l.args.user,
        rail: l.args.rail,
        reason: l.eventName === 'Declined' ? l.args.reason : Reason.NONE,
        tx: l.transactionHash!,
        block: l.blockNumber!.toString(),
        at: Date.now(),
      });
    }
    known.sort((x, y) => Number(BigInt(y.block) - BigInt(x.block)));
    sales.set(known.slice(0, 50));
    setList(known.slice(0, 6));
    const mine = known.find((s) => s.orderId === reqRef.current?.orderId);
    if (mine) {
      setResult(mine);
      setReq(null);
      if (mine.ok) beep();
    }
  }, []);

  // Watch Paid / Declined for this shop (indexed topic), every 500 ms.
  useEffect(() => {
    setList(sales.get().slice(0, 6));
    const t = setInterval(async () => {
      const to = latest.current;
      if (to === null) return;
      let from = cursor.current ?? to - MAX_RANGE;
      if (to - from > MAX_RANGE) from = to - MAX_RANGE;
      if (from > to) return;
      try {
        const logs = (await publicClient.request({
          method: 'eth_getLogs',
          params: [{ address: CUANLATER, fromBlock: toHex(from < 0n ? 0n : from), toBlock: toHex(to), topics: [topics, null, pad(SHOP)] }],
        })) as unknown as Log[];
        cursor.current = to + 1n;
        record(logs.map((l) => ({ ...l, blockNumber: BigInt(l.blockNumber as unknown as Hex) })));
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, [record]);

  // The phone tells us its tx hash and how long Approve took.
  useEffect(
    () =>
      subscribe((m) => {
        if (m.type !== 'sent' || m.orderId !== reqRef.current?.orderId) return;
        setMs(m.ms);
        publicClient.getTransactionReceipt({ hash: m.txHash }).then((r) => record(r.logs), () => {});
      }),
    [record],
  );

  const pick = (k: keyof typeof ITEMS) => {
    setItem(k);
    setAmountStr((Number(ITEMS[k].amount) / 1e6).toFixed(2));
  };
  const key = (k: string) => {
    setItem('custom');
    setAmountStr((s) => {
      if (k === '⌫') return s.slice(0, -1);
      const next = s === '0' && k !== '.' ? k : s + k;
      return parseUsd(next) !== null ? next : s;
    });
  };
  const charge = () => {
    if (!amount) return;
    const r = newRequest(item, amount, rail);
    itemsByOrder.set({ ...itemsByOrder.get(), [r.orderId]: item });
    setResult(null);
    setMs(null);
    setReq(r);
    post({ type: 'request', request: r });
  };
  const cancel = () => {
    if (req) post({ type: 'cancel', orderId: req.orderId });
    setReq(null);
  };
  const reset = () => {
    setResult(null);
    setReq(null);
  };
  const receivedToday = sales
    .get()
    .filter((s) => s.ok && new Date(s.at).toDateString() === new Date().toDateString())
    .reduce((x, s) => x + BigInt(s.amount), 0n);

  return {
    amountStr, amount, item, rail, setRail, req, result, ms, list, receivedToday, pick, key, charge, cancel, reset,
    lastBlock: blockSeconds(b),
    status: result ? (result.ok ? 'approved' : 'declined') : req ? 'waiting' : 'idle',
  } as const;
}

export type Terminal = ReturnType<typeof useTerminal>;

function RailTabs({ t }: { t: Terminal }) {
  return (
    <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[10px] bg-sunken p-1">
      {(['card', 'qris'] as const).map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={t.rail === r}
          disabled={t.status === 'waiting'}
          onClick={() => t.setRail(r)}
          className={`min-h-11 rounded-lg text-sm font-semibold ${t.rail === r ? 'bg-raised shadow' : 'text-ink-2'}`}
        >
          {r === 'card' ? 'Card tap (Visa / MC)' : 'QRIS dynamic QR'}
        </button>
      ))}
    </div>
  );
}

function Presets({ t }: { t: Terminal }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(ITEMS) as (keyof typeof ITEMS)[]).map((k) => (
        <button
          key={k}
          onClick={() => t.pick(k)}
          disabled={t.status === 'waiting'}
          className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${t.item === k ? 'border-primary bg-info-bg' : 'border-line-2'}`}
        >
          {ITEMS[k].label} {usd(ITEMS[k].amount)}
        </button>
      ))}
    </div>
  );
}

const chargeLabel = (t: Terminal) =>
  t.rail === 'card' ? `Charge ${usd(t.amount ?? 0n)}` : `Show QRIS for ${usd(t.amount ?? 0n)}`;

export function Standee({ t }: { t: Terminal }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(location.origin), []);
  const amt = t.req ? BigInt(t.req.amount) : (t.amount ?? 0n);
  return (
    <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-card border border-line bg-white text-ink shadow">
      <div className="bg-card px-4 py-2 text-center text-sm font-bold tracking-wide text-white [clip-path:polygon(0_0,100%_0,100%_80%,0_100%)]">
        QRIS · SANDBOX DEMO
      </div>
      <div className="space-y-2 p-4 text-center">
        <div className="text-xs font-semibold">KANTIN BLITZ · NMID: ID102026MONAD</div>
        <div className="mx-auto grid size-[180px] place-items-center rounded bg-sunken">
          {t.req && origin ? (
            <QRCodeSVG value={requestUrl(t.req, origin)} size={172} aria-label="Payment QR" />
          ) : (
            <span className="px-4 text-xs text-ink-3">Press Show QRIS to make the code</span>
          )}
        </div>
        <div className="text-sm font-semibold">
          {usd(amt)} (≈ Rp {idrPlain(amt)}) · {itemLabel(t.req?.item ?? t.item)}
        </div>
        <Chip tone="warn">Sandbox · not a real QRIS code</Chip>
      </div>
      <div className="h-6 bg-card [clip-path:polygon(0_40%,100%_0,100%_100%,0_100%)]" />
    </div>
  );
}

function Outcome({ t, compact = false }: { t: Terminal; compact?: boolean }) {
  const r = t.result!;
  return (
    <div aria-live="polite" className={`space-y-3 rounded-card p-5 ${r.ok ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`}>
      <div className="text-3xl font-black tracking-wide">{r.ok ? 'APPROVED' : 'DECLINED'}</div>
      <div className="text-2xl font-bold text-ink">{usd(BigInt(r.amount))}</div>
      <div className="text-sm text-ink-2">
        {r.ok
          ? `${saleItem(r.orderId)} · paid by Cuan Card •••• ${last4(r.user)}`
          : `${reasonLine[r.reason as Reason]} · nothing charged`}
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-2">
          {r.ok && <Chip tone="ok">Confirmed in 1 block{t.ms ? ` · ${(t.ms / 1000).toFixed(1)} s` : ''}</Chip>}
          {r.ok && <Chip>Customer&apos;s stock sold: 0</Chip>}
          <Chip>Rail: {r.rail === Rail.QRIS ? 'QRIS' : 'card tap'}</Chip>
        </div>
      )}
      <a href={txUrl(r.tx)} target="_blank" rel="noreferrer" className="block text-sm text-ink">
        View transaction on the explorer
      </a>
    </div>
  );
}

export function RecentSales({ t }: { t: Terminal }) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold">Recent sales</h2>
      <ul className="divide-y divide-line rounded-card border border-line bg-raised">
        {t.list.length === 0 && <li className="p-3 text-sm text-ink-3">No sales yet.</li>}
        {t.list.map((s) => (
          <li key={`${s.tx}-${s.orderId}`} className="flex items-center justify-between gap-2 p-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {saleItem(s.orderId)} · {usd(BigInt(s.amount))}
                <Chip>{s.rail === Rail.QRIS ? 'QRIS' : `Card •••• ${last4(s.user)}`}</Chip>
              </div>
              <div className="text-xs text-ink-3">
                {s.ok ? (
                  <>
                    Confirmed in 1 block ·{' '}
                    <a href={txUrl(s.tx)} target="_blank" rel="noreferrer">
                      View on explorer
                    </a>
                  </>
                ) : (
                  `${reasonLine[s.reason as Reason]} · nothing charged`
                )}
              </div>
            </div>
            <Chip tone={s.ok ? 'ok' : 'bad'}>{s.ok ? 'Approved' : 'Declined'}</Chip>
          </li>
        ))}
      </ul>
      <div className="text-sm text-ink-2">Received today {usd(t.receivedToday)}</div>
    </section>
  );
}

/** Full laptop terminal (/terminal). */
export function TerminalFull() {
  const t = useTerminal();
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-lg bg-card font-bold text-white">K</span>
          <div>
            <div className="text-lg font-bold">Kantin Blitz</div>
            <div className="text-sm text-ink-2">Shop terminal · accepts Cuan Card</div>
          </div>
        </div>
        <Chip tone="info">Monad testnet · demo dollars</Chip>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-card border border-line bg-raised p-4">
          <div>
            <div className="text-sm text-ink-2">Amount</div>
            <div className="text-5xl font-bold">{t.amount !== null ? usd(t.amount) : '$0.00'}</div>
          </div>
          <Presets t={t} />
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
              <button
                key={k}
                aria-label={k === '⌫' ? 'Delete' : k}
                disabled={t.status === 'waiting'}
                onClick={() => t.key(k)}
                className="min-h-12 rounded-[10px] border border-line text-lg font-semibold hover:bg-sunken"
              >
                {k}
              </button>
            ))}
          </div>
          <RailTabs t={t} />
          {t.status === 'waiting' ? (
            <Button variant="secondary" onClick={t.cancel}>
              Cancel sale
            </Button>
          ) : (
            <Button onClick={t.charge} disabled={!t.amount}>
              {chargeLabel(t)}
            </Button>
          )}
        </section>
        <section className="space-y-4">
          {t.result ? (
            <>
              <Outcome t={t} />
              <RecentSales t={t} />
              <Button onClick={t.reset}>New sale</Button>
            </>
          ) : t.rail === 'card' ? (
            <div className="space-y-4 rounded-card border border-line bg-raised p-6 text-center">
              <Chip tone={t.req ? 'warn' : 'ok'}>{t.req ? 'Waiting for the customer to approve' : 'Ready to charge'}</Chip>
              <div className="mx-auto grid size-32 place-items-center rounded-full bg-sunken">
                <Contactless className="size-14" />
              </div>
              <div className="text-xl font-bold">Tap Cuan Card</div>
              <p className="text-sm text-ink-2">
                Press Charge and the request pops up on the customer&apos;s phone. One tap approves it and you receive{' '}
                {usd(t.amount ?? 0n)} in the same block. No QR, no camera.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-card border border-line bg-raised p-6 text-center">
              <Standee t={t} />
              <p className="text-sm text-ink-2">
                Customer can scan this QRIS or tap &quot;Pay via QRIS (simulated)&quot; on the phone to execute the on-chain
                payment in 1 Monad block.
              </p>
              <Chip tone="warn">{t.req ? 'Waiting for the scan' : 'Ready'}</Chip>
            </div>
          )}
          {!t.result && <RecentSales t={t} />}
        </section>
      </div>
    </div>
  );
}

/** Compact terminal for the /demo projector layout. */
export function TerminalCompact({ t }: { t: Terminal }) {
  return (
    <section className="space-y-3 rounded-card border border-line bg-raised p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Kantin Blitz</div>
          <div className="text-3xl font-bold">{usd(t.req ? BigInt(t.req.amount) : (t.amount ?? 0n))}</div>
          <div className="text-sm text-ink-2">{itemLabel(t.req?.item ?? t.item)}</div>
        </div>
        <Chip tone={t.status === 'approved' ? 'ok' : t.status === 'declined' ? 'bad' : t.status === 'waiting' ? 'warn' : 'neutral'}>
          {{ idle: 'Ready to charge', waiting: 'Waiting for approval', approved: 'Approved', declined: 'Declined' }[t.status]}
        </Chip>
      </div>
      <Presets t={t} />
      <RailTabs t={t} />
      {t.result && <Outcome t={t} compact />}
      {t.status === 'waiting' && t.rail === 'qris' && t.req && <Standee t={t} />}
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-ink-3">Rail</dt>
          <dd className="font-semibold">{t.rail === 'qris' ? 'QRIS' : 'Card tap'}</dd>
        </div>
        <div>
          <dt className="text-ink-3">You receive</dt>
          <dd className="font-semibold">{usd(t.amount ?? 0n)}, same block</dd>
        </div>
        <div>
          <dt className="text-ink-3">Last block</dt>
          <dd className="font-semibold">{t.lastBlock ? `${t.lastBlock} s` : '…'}</dd>
        </div>
      </dl>
      {t.status === 'waiting' ? (
        <Button variant="secondary" onClick={t.cancel}>
          Cancel sale
        </Button>
      ) : t.result ? (
        <Button onClick={t.reset}>New sale</Button>
      ) : (
        <Button onClick={t.charge} disabled={!t.amount}>
          {chargeLabel(t)}
        </Button>
      )}
    </section>
  );
}
