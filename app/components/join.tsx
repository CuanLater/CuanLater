'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { Button, Chip, Mark } from './ui';

/** Board 1 · Join */
export function Join() {
  const wallet = useWallet();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = (fn: () => Promise<unknown>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError((err as Error)?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <Mark />
        <Chip tone="info">Testnet demo</Chip>
      </header>
      <div className="space-y-2">
        <h1 className="text-2xl leading-tight font-bold">Buy with your stock. Keep your stock.</h1>
        <p className="text-sm text-ink-2">
          Tap to pay at a shop by borrowing a little against your stock. If the stock goes up, the profit pays the debt
          for you.
        </p>
      </div>
      <section className="rounded-card border border-line bg-raised p-4">
        <div className="text-xs font-semibold text-ink-3 uppercase">You will get</div>
        <div className="mt-1 text-xl font-bold">1.0000 tNVDA ≈ $40.00</div>
        <div className="mt-1 text-sm text-ink-2">Locked as your guarantee. You keep all of it.</div>
      </section>
      <ol className="space-y-2 text-sm">
        {[
          'The shop charges, you tap Approve.',
          'Your stock is not sold. You owe a small debt instead.',
          'When the stock rises, the profit pays the debt. No profit? Pay back like a credit card.',
        ].map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-xs font-bold">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {step === 'email' ? (
        <form
          className="space-y-3"
          onSubmit={run(async () => {
            if ((await wallet.sendCode(email)) === 'code') setStep('code');
          })}
        >
          <label className="block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required={wallet.mode === 'privy'}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-h-11 w-full rounded-[10px] border border-line-2 bg-raised px-3"
          />
          <Button type="submit" disabled={busy || !wallet.ready}>
            {busy ? 'Sending…' : 'Continue with email'}
          </Button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={run(() => wallet.verify(code))}>
          <label className="block text-sm font-semibold" htmlFor="code">
            Code sent to {email}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-11 w-full rounded-[10px] border border-line-2 bg-raised px-3 font-mono tracking-widest"
          />
          <Button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Verify and get my card'}
          </Button>
        </form>
      )}
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-3">
        No app or wallet needed. Network fees are paid for you. Demo tokens on Monad testnet; prices are a replay.
      </p>
    </div>
  );
}
