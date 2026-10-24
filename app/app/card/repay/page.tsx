'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/wallet';
import { useUsdBalance } from '@/lib/hooks';
import { change, pct, shares, usd, usdDown } from '@/lib/format';
import { useCard } from '@/components/card-context';
import { HealthBar, healthLabel } from '@/components/card';
import { Button, Chip, LinkButton } from '@/components/ui';

/** Board 7 · No profit: pay back yourself */
export default function Repay() {
  const { address, view: v, refresh } = useCard();
  const wallet = useWallet();
  const cash = useUsdBalance(address);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const act = async (name: string, fn: string, args: readonly unknown[] = [], done = '') => {
    setBusy(name);
    setMsg('');
    try {
      await wallet.send(fn, args);
      await refresh();
      setMsg(done);
    } catch (e) {
      setMsg((e as { shortMessage?: string })?.shortMessage ?? (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  // same rounding as the contract: shares rounded up so the debt is fully covered
  const stockNeeded = v.price ? (v.debt * 10n ** 18n + v.price - 1n) / v.price : 0n;
  const canCash = cash !== null && cash >= v.debt;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/card" className="text-sm">
          Back
        </Link>
        <Chip tone="warn">
          tNVDA {usd(v.price)} · {change(v.price, v.entryPrice)} · replay
        </Chip>
      </div>
      <h1 className="text-2xl font-bold">You owe {usd(v.debt)}</h1>
      <p className="text-sm text-ink-2">No profit yet, so pay back whenever you like. There is no deadline while your loan is safe.</p>
      <div className="space-y-2 rounded-card border border-line bg-raised p-4">
        <HealthBar health={v.health} marker />
        <div className="text-sm">
          {healthLabel(v.health)} · debt is {pct(v.health)} of stock
        </div>
      </div>

      <ol className="space-y-3">
        <li className="space-y-2 rounded-card border border-line bg-raised p-4">
          <div className="font-semibold">1 · Pay with cash</div>
          <p className="text-sm text-ink-2">
            Like paying a credit card bill. Cash balance: {cash === null ? '…' : usdDown(cash)}
          </p>
          <Button disabled={!!busy || v.debt === 0n || !canCash} onClick={() => act('cash', 'repay', [v.debt], 'Paid back.')}>
            {busy === 'cash' ? 'Paying…' : `Pay ${usd(v.debt)} with cash`}
          </Button>
          {!canCash && v.debt > 0n && <p className="text-xs text-ink-3">Top up first to have enough cash.</p>}
        </li>
        <li className="space-y-2 rounded-card border border-line bg-raised p-4">
          <div className="font-semibold">2 · Pay with a little stock</div>
          <p className="text-sm text-ink-2">
            Sells ≈ {shares(stockNeeded)} tNVDA ({usd(v.debt)}). You pick the moment, not the café.
          </p>
          <Button
            variant="secondary"
            disabled={!!busy || v.debt === 0n}
            onClick={() => act('stock', 'repayWithStock', [], 'Paid back with stock.')}
          >
            {busy === 'stock' ? 'Selling…' : `Pay ${usd(v.debt)} with stock`}
          </Button>
        </li>
        <li className="rounded-card border border-line bg-raised p-4">
          <div className="font-semibold">3 · Just wait</div>
          <p className="text-sm text-ink-2">If tNVDA rises, Bayar pakai cuan pays it for you.</p>
        </li>
      </ol>

      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}

      <Button variant="secondary" disabled={!!busy} onClick={() => act('top', 'topUp', [], 'Added $10.00 cash.')}>
        {busy === 'top' ? 'Adding…' : 'Top up $10 (pretend salary)'}
      </Button>
      <LinkButton variant="ghost" href="/card/safety">
        What if it crashes?
      </LinkButton>
    </div>
  );
}
