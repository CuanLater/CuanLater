import type { Address } from 'viem';
import type { AccountView } from '@/lib/hooks';
import { CAREFUL_BPS, LIQUIDATION_BPS } from '@/lib/constants';
import { last4, pct, shares, usd, usdDown } from '@/lib/format';
import { Contactless } from './ui';

export function CardFace({ v, address }: { v: AccountView; address?: Address }) {
  const frozen = v.frozen;
  const whole = v.shares === 10n ** 18n ? '1' : shares(v.shares);
  return (
    <div
      className={`relative flex h-[206px] flex-col justify-between overflow-hidden rounded-2xl p-5 text-white ${frozen ? 'bg-[#6b6b73]' : 'bg-card'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold">Cuan Card</span>
        <div className="flex gap-1.5">
          {frozen && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink">FROZEN</span>}
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">QRIS ready</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">TESTNET</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xs text-white/70">Available to spend today</div>
          <div className="text-3xl font-bold">{frozen ? '$0.00 while frozen' : usdDown(v.available)}</div>
          <div className="text-xs text-white/70">
            {pct(v.limitBps).replace('.0', '')} of your stock · {v.isWeekend ? 'weekend' : 'weekday'} limit
          </div>
        </div>
        <div className="text-right text-[10px] leading-tight text-white/70">
          Visa / MC rail
          <div className="font-bold tracking-widest text-white">SANDBOX</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>
          {whole} tNVDA ≈ {usd(v.value)} locked
        </span>
        <span className="flex items-center gap-2 font-mono">
          •••• {last4(address)}
          <Contactless className="size-5" />
        </span>
      </div>
    </div>
  );
}

export const healthLabel = (h: bigint) => (h < CAREFUL_BPS ? 'Safe' : h <= LIQUIDATION_BPS ? 'Careful' : 'Auto-sell');

/** 3-part bar: Safe < 35% ≤ Careful ≤ 50% < Auto-sell. */
export function HealthBar({ health, marker = false }: { health: bigint; marker?: boolean }) {
  const label = healthLabel(health);
  const seg = (name: string, cls: string, grow: number) => (
    <div className={`h-2 rounded-full ${label === name ? cls : 'bg-line'}`} style={{ flexGrow: grow }} />
  );
  // marker sits at health / 70% of the bar width
  const left = Math.min(100, (Number(health) / 7000) * 100);
  return (
    <div className="relative" role="img" aria-label={`Loan health ${label}, debt is ${pct(health)} of stock`}>
      <div className="flex gap-1">
        {seg('Safe', 'bg-ok-solid', 35)}
        {seg('Careful', 'bg-warn-solid', 15)}
        {seg('Auto-sell', 'bg-bad-solid', 20)}
      </div>
      {marker && <div className="absolute -top-1 h-4 w-1 rounded bg-ink" style={{ left: `${left}%` }} />}
    </div>
  );
}

/** Tape line with a dot at the current index. */
export function Sparkline({ points, index, className = 'h-16 w-full' }: { points: bigint[]; index?: number; className?: string }) {
  if (points.length < 2) return null;
  const nums = points.map(Number);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const W = 300;
  const H = 60;
  const xy = (n: number, i: number) => [(i / (nums.length - 1)) * W, H - 4 - ((n - min) / (max - min || 1)) * (H - 8)];
  const d = nums.map((n, i) => `${i ? 'L' : 'M'}${xy(n, i).join(',')}`).join('');
  const dot = index !== undefined ? xy(nums[index], index) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill="none" stroke="var(--okb-market-positive-line)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {dot && <circle cx={dot[0]} cy={dot[1]} r="5" fill="var(--okb-text-primary)" />}
    </svg>
  );
}
