'use client';

import { useRouter } from 'next/navigation';
import { ITEMS } from '@/lib/constants';
import { usd } from '@/lib/format';
import { newRequest, requestQuery } from '@/lib/requests';
import { Sheet } from './sheet';

/** Used when no request came from a terminal (a judge trying it on one device). */
export function ItemPicker({ rail, onClose }: { rail: 'card' | 'qris'; onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet title={rail === 'qris' ? 'Pay via QRIS at Kantin Blitz' : 'Tap card at Kantin Blitz'} onClose={onClose}>
      <ul className="grid grid-cols-2 gap-2">
        {(Object.keys(ITEMS) as (keyof typeof ITEMS)[]).map((k) => (
          <li key={k}>
            <button
              className="min-h-16 w-full rounded-card border border-line-2 p-3 text-left hover:bg-sunken"
              onClick={() => router.push(`/card/pay?${requestQuery(newRequest(k, ITEMS[k].amount, rail))}`)}
            >
              <div className="font-semibold">{ITEMS[k].label}</div>
              <div className="text-sm text-ink-2">{usd(ITEMS[k].amount)}</div>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
