'use client';

import { createContext, useContext } from 'react';
import type { Address } from 'viem';
import { store, type AccountView } from '@/lib/hooks';
import type { PaymentRequest } from '@/lib/requests';

type Card = { address: Address; view: AccountView; refresh: () => Promise<void> };
export const CardCtx = createContext<Card | null>(null);
export const useCard = () => useContext(CardCtx)!;

/** Last request from the terminal that the phone hasn't acted on (expires after 5 min). */
export const pending = store<PaymentRequest | null>('cuanlater.pending', null);
export const freshPending = (rail?: 'card' | 'qris') => {
  const p = pending.get();
  return p && Date.now() - p.createdAt < 5 * 60_000 && (!rail || p.rail === rail) ? p : null;
};
/** Items bought since the debt was last $0, for the profit screen. */
export const openItems = store<string[]>('cuanlater.openItems', []);

