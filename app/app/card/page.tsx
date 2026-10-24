'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCard, freshPending } from '@/components/card-context';
import { Sheet } from '@/components/sheet';
import { useWallet } from '@/lib/wallet';
import { useBlock } from '@/lib/hooks';
import { CardFace, HealthBar, healthLabel } from '@/components/card';
import { Button, Chip, Mark } from '@/components/ui';
import { ItemPicker } from '@/components/item-picker';
import { parseUsd, pct, usd, weekdayName } from '@/lib/format';
import { requestQuery } from '@/lib/requests';

/** Board 2 · Cuan Card home */
export default function Home() {
  const { address, view: v, refresh } = useCard();
  const wallet = useWallet();
  const router = useRouter();
  const b = useBlock();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'card' | 'qris' | null>(null);
  const [limitSheet, setLimitSheet] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  const day = weekdayName(b?.timestamp ?? Math.floor(Date.now() / 1000));
  const act = async (name: string, fn: string, args: readonly unknown[] = []) => {
    setBusy(name);
    setError('');
    try {
      await wallet.send(fn, args);
      await refresh();
    } catch (e) {
      setError((e as { shortMessage?: string })?.shortMessage ?? (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const open = (rail: 'card' | 'qris') => {
    const p = freshPending(rail);
    if (p) router.push(`/card/pay?${requestQuery(p)}`);
    else setPicker(rail);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Mark />
        <Chip tone={v.isWeekend ? 'warn' : 'neutral'}>
          {day} · {v.isWeekend ? 'weekend' : 'weekday'} limit
        </Chip>
      </header>

      <CardFace v={v} address={address} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line bg-raised p-3">
          <div className="text-xs text-ink-2">You owe</div>
          <div className="text-xl font-bold">{usd(v.debt)}</div>
          <div className="text-xs text-ink-3">No deadline while safe</div>
        </div>
        <div className="rounded-card border border-line bg-raised p-3">
          <div className="text-xs text-ink-2">Loan health</div>
          <div className="text-xl font-bold">{healthLabel(v.health)}</div>
          <div className="mt-2">
            <HealthBar health={v.health} />
          </div>
          <div className="mt-1 text-xs text-ink-3">Debt is {pct(v.health)} of stock</div>
        </div>
      </div>

      <ul className="divide-y divide-line rounded-card border border-line bg-raised">
        <li className="flex min-h-14 items-center justify-between gap-3 px-4">
          <div>
            <div className="text-sm font-semibold">Bayar pakai cuan</div>
            <div className="text-xs text-ink-3">Profit pays your debt, checked every block</div>
          </div>
          <button
            role="switch"
            aria-checked={v.autoRepay}
            aria-label="Bayar pakai cuan"
            disabled={!!busy}
            onClick={() => act('auto', 'setAutoRepay', [!v.autoRepay])}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${v.autoRepay ? 'bg-ok-solid' : 'bg-line-2'}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${v.autoRepay ? 'left-6' : 'left-1'}`} />
          </button>
        </li>
        <li className="flex min-h-14 items-center justify-between gap-3 px-4">
          <div className="text-sm font-semibold">Freeze card</div>
          <button
            aria-label={v.frozen ? 'Card frozen: tap to unfreeze' : 'Freeze card'}
            className="min-h-11 rounded-[10px] border border-line-2 px-4 text-sm font-semibold"
            disabled={!!busy}
            onClick={() => act('freeze', v.frozen ? 'unfreeze' : 'freeze')}
          >
            {busy === 'freeze' ? '…' : v.frozen ? 'On' : 'Off'}
          </button>
        </li>
        <li className="flex min-h-14 items-center justify-between gap-3 px-4">
          <div>
            <div className="text-sm font-semibold">Daily limit</div>
            <div className="text-xs text-ink-3">{v.dailyLimit > 0n ? `${usd(v.dailyLimit)} a day` : 'Off'}</div>
          </div>
          <button
            aria-label="Set daily limit"
            className="min-h-11 rounded-[10px] border border-line-2 px-4 text-sm font-semibold"
            onClick={() => setLimitSheet(true)}
          >
            Set
          </button>
        </li>
      </ul>

      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}

      <Link href="/card/repay" className="flex min-h-11 items-center justify-center text-sm">
        Pay back or top up
      </Link>

      <div className="space-y-2">
        <Button onClick={() => open('card')}>Tap card at Kantin Blitz</Button>
        <Button variant="secondary" onClick={() => open('qris')}>
          Pay via QRIS (simulated)
        </Button>
      </div>

      {picker && <ItemPicker rail={picker} onClose={() => setPicker(null)} />}

      {limitSheet && (
        <Sheet title="Daily limit" onClose={() => setLimitSheet(false)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const amt = limitInput === '' ? 0n : parseUsd(limitInput);
              if (amt === null) return setError('Enter an amount like 5.00');
              setLimitSheet(false);
              await act('limit', 'setDailyLimit', [amt]);
            }}
          >
            <label htmlFor="limit" className="block text-sm text-ink-2">
              Amount per day in dollars. Leave empty to turn it off.
            </label>
            <input
              id="limit"
              inputMode="decimal"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder="5.00"
              className="min-h-11 w-full rounded-[10px] border border-line-2 px-3"
            />
            <Button type="submit">Save</Button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
