'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { useAccountView, useBlock, useTape } from '@/lib/hooks';
import { change, usd, weekdayName } from '@/lib/format';
import { START_PRICE } from '@/lib/constants';
import { cuanLaterAbi } from '@/lib/abi';
import { publicClient } from '@/lib/chain';
import { CUANLATER } from '@/lib/deployments';
import { TerminalCompact, useTerminal } from '@/components/terminal';
import { Sparkline } from '@/components/card';
import { Button, Chip } from '@/components/ui';

/** Live demo layout, 1440 × 810 projector. The phone is the real /card app in an iframe. */
export default function Demo() {
  const t = useTerminal();
  const wallet = useWallet();
  const { view } = useAccountView(wallet.address);
  const { tape, index, running } = useTape();
  const b = useBlock();
  const [busy, setBusy] = useState<string | null>(null);
  const [profitPaid, setProfitPaid] = useState(false);
  const peakDebt = useRef(0n);

  // Step 4 lights up once open debt from the demo goes back to $0.00.
  useEffect(() => {
    if (!view) return;
    if (view.debt > peakDebt.current) peakDebt.current = view.debt;
    if (peakDebt.current > 0n && view.debt === 0n) setProfitPaid(true);
    if (view.debt > 0n) setProfitPaid(false);
  }, [view]);

  const step = profitPaid ? 4 : t.status === 'approved' ? 3 : t.status === 'waiting' ? 2 : 1;
  const weekend = view?.isWeekend ?? false;
  const price = tape?.price ?? START_PRICE;

  const act = async (name: string, fn: string, args: readonly unknown[] = []) => {
    setBusy(name);
    try {
      await wallet.send(fn, args);
    } catch {}
    setBusy(null);
  };
  const harvestNow = async () => {
    const n = await publicClient.readContract({ address: CUANLATER, abi: cuanLaterAbi, functionName: 'membersLength' });
    await act('harvest', 'harvestRange', [0n, n]);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col gap-4 p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold">CuanLater · live demo</h1>
        {['Shop charges', 'You approve', 'Approved on Monad', 'Profit pays'].map((s, i) => (
          <Chip key={s} tone={step === i + 1 ? 'info' : 'neutral'} className={step === i + 1 ? 'ring-2 ring-info' : ''}>
            {i + 1} {s}
          </Chip>
        ))}
        <Chip tone="warn">
          {weekdayName(b?.timestamp ?? Date.now() / 1000)} · {weekend ? 'weekend limit 25%' : 'weekday limit 35%'}
        </Chip>
        <Chip>Monad testnet</Chip>
      </header>

      <div className="grid flex-1 gap-5 lg:grid-cols-[410px_1fr]">
        <div className="mx-auto h-[700px] w-[410px] overflow-hidden rounded-[44px] border-[10px] border-card bg-canvas shadow-xl">
          <iframe src="/card" title="Cuan Card phone" className="h-full w-full" />
        </div>

        <div className="flex flex-col gap-4">
          <TerminalCompact t={t} />

          <section className="space-y-3 rounded-card border border-line bg-raised p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Chip tone="warn">REPLAY</Chip>
              <span className="text-3xl font-bold">{usd(price)}</span>
              <span className={price >= START_PRICE ? 'text-ok' : 'text-bad'}>{change(price, START_PRICE)} since start</span>
              <span className="text-sm text-ink-3">tNVDA · start $40.00</span>
              <span className="ml-auto text-sm font-semibold">
                Coffee + es teh {usd(view?.debt ?? 0n)} → $0.00
              </span>
            </div>
            {tape && <Sparkline points={tape.points} index={index} className="h-24 w-full" />}
            <div className="grid grid-cols-2 gap-3">
              <Button disabled={running || !wallet.address || !!busy} onClick={() => act('tape', 'startTape')}>
                {busy === 'tape' ? 'Starting…' : running ? 'Replay running…' : 'Start price replay'}
              </Button>
              <Button variant="secondary" disabled={!wallet.address || !!busy} onClick={harvestNow}>
                {busy === 'harvest' ? 'Harvesting…' : 'Harvest now'}
              </Button>
            </div>
            {!wallet.address && <p className="text-sm text-ink-3">Log in on the phone first.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
