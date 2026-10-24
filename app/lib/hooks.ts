'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Address } from 'viem';
import { cuanLaterAbi, mockUsdAbi } from './abi';
import { publicClient } from './chain';
import { CUANLATER, USD } from './deployments';

// One block subscription for the whole page; keeps the last 11 timestamps for "Last block".
type BlockState = { number: bigint; timestamp: number; intervals: number[] };
let block: BlockState | null = null;
const subs = new Set<() => void>();
let unwatch: (() => void) | null = null;

function subscribeBlocks(cb: () => void) {
  subs.add(cb);
  if (!unwatch) {
    const times: number[] = [];
    unwatch = publicClient.watchBlocks({
      emitMissed: false,
      onBlock: (b) => {
        times.push(Number(b.timestamp));
        if (times.length > 11) times.shift();
        const intervals = times.slice(1).map((t, i) => t - times[i]);
        block = { number: b.number!, timestamp: Number(b.timestamp), intervals };
        subs.forEach((s) => s());
      },
      onError: () => {},
    });
  }
  return () => {
    subs.delete(cb);
    if (subs.size === 0 && unwatch) {
      unwatch();
      unwatch = null;
    }
  };
}

export const useBlock = () => useSyncExternalStore(subscribeBlocks, () => block, () => null);

/** Average seconds between the last 10 blocks; one decimal. */
export function blockSeconds(b: BlockState | null) {
  if (!b || b.intervals.length === 0) return null;
  return (b.intervals.reduce((x, y) => x + y, 0) / b.intervals.length).toFixed(1);
}

export type AccountView = {
  shares: bigint;
  debt: bigint;
  principal: bigint;
  entryPrice: bigint;
  dailyLimit: bigint;
  spentToday: bigint;
  dayIndex: bigint;
  tapLimit: bigint;
  joined: boolean;
  autoRepay: boolean;
  frozen: boolean;
  value: bigint;
  limit: bigint;
  available: bigint;
  health: bigint;
  price: bigint;
  isWeekend: boolean;
  limitBps: bigint;
  spentTodayNow: bigint;
};

/** accountView(user), refetched on every new block. */
export function useAccountView(user?: Address) {
  const b = useBlock();
  const [view, setView] = useState<AccountView | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const v = await publicClient.readContract({ address: CUANLATER, abi: cuanLaterAbi, functionName: 'accountView', args: [user] });
      setView(v as AccountView);
    } catch {}
  }, [user]);
  useEffect(() => {
    refresh();
  }, [refresh, b?.number]);
  return { view, refresh };
}

export function useUsdBalance(user?: Address) {
  const b = useBlock();
  const [bal, setBal] = useState<bigint | null>(null);
  useEffect(() => {
    if (!user) return;
    publicClient
      .readContract({ address: USD, abi: mockUsdAbi, functionName: 'balanceOf', args: [user] })
      .then(setBal, () => {});
  }, [user, b?.number]);
  return bal;
}

export type TapeState = { points: bigint[]; start: bigint; step: bigint; price: bigint };

/** Price tape and where we are on it. */
export function useTape() {
  const b = useBlock();
  const [tape, setTape] = useState<TapeState | null>(null);
  useEffect(() => {
    const c = { address: CUANLATER, abi: cuanLaterAbi } as const;
    Promise.all([
      publicClient.readContract({ ...c, functionName: 'tapePoints' }),
      publicClient.readContract({ ...c, functionName: 'tapeStart' }),
      publicClient.readContract({ ...c, functionName: 'tapeStep' }),
      publicClient.readContract({ ...c, functionName: 'price' }),
    ]).then(([points, start, step, price]) => setTape({ points: points.map(BigInt), start, step, price }), () => {});
  }, [b?.number]);
  const index =
    tape && b
      ? tape.start === 0n
        ? 0
        : Math.min(Number((b.number - tape.start) / tape.step), tape.points.length - 1)
      : 0;
  const running = !!tape && !!b && tape.start !== 0n && b.number < tape.start + BigInt(tape.points.length) * tape.step;
  return { tape, index, running };
}

/** Simple localStorage JSON value; empty when storage is blocked. */
export function store<T>(key: string, fallback: T) {
  return {
    get(): T {
      try {
        const v = localStorage.getItem(key);
        return v ? (JSON.parse(v) as T) : fallback;
      } catch {
        return fallback;
      }
    },
    set(v: T) {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
    },
  };
}
