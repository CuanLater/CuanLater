import { IDR_PER_USD } from './constants.ts';

const cents = (c: bigint) => {
  const neg = c < 0n;
  const a = neg ? -c : c;
  return `${neg ? '−' : ''}$${(a / 100n).toLocaleString('en-US')}.${(a % 100n).toString().padStart(2, '0')}`;
};

/** Money owed or charged (6 dec): round half-up to cents. 3_015000 → $3.02 */
export const usd = (x: bigint) => cents(x < 0n ? -((-x + 5000n) / 10000n) : (x + 5000n) / 10000n);
/** Money you can still spend: round down to cents. 6_985000 → $6.98 */
export const usdDown = (x: bigint) => cents((x < 0n ? 0n : x) / 10000n);
/** Shares (18 dec) to 4 decimals, half-up. */
export const shares = (x: bigint) => {
  const t = (x + 50_000_000_000_000n) / 100_000_000_000_000n;
  return `${t / 10000n}.${(t % 10000n).toString().padStart(4, '0')}`;
};
/** ≈ Rp 48.000 */
export const idr = (x: bigint) =>
  `≈ Rp ${Math.round((Number(x) / 1e6) * IDR_PER_USD).toLocaleString('id-ID')}`;
export const idrPlain = (x: bigint) => Math.round((Number(x) / 1e6) * IDR_PER_USD).toLocaleString('id-ID');
/** 880 → 8.8% */
export const pct = (bps: bigint) => `${(Number(bps) / 100).toFixed(1)}%`;
/** +10.00% */
export const change = (p: bigint, base: bigint) => {
  const v = base === 0n ? 0 : (Number(p - base) / Number(base)) * 100;
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
};
/** 4 digits derived from the wallet address. */
export const last4 = (addr?: string) => (addr ? (BigInt(addr) % 10000n).toString().padStart(4, '0') : '0000');
/** 0x1234 5678 ... in groups of 4 */
export const groups4 = (addr: string) => addr.match(/.{1,4}/g)!.join(' ');
export const weekdayName = (tsSec: number) =>
  new Date(tsSec * 1000).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
/** Parse "3.50" into 6-dec base units; null when invalid. */
export const parseUsd = (s: string): bigint | null => {
  if (!/^\d{0,6}(\.\d{0,2})?$/.test(s) || s === '' || s === '.') return null;
  const [w, f = ''] = s.split('.');
  return BigInt(w || '0') * 1_000000n + BigInt((f + '00').slice(0, 2)) * 10000n;
};
