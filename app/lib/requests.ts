import { z } from 'zod';
import { isAddress, isAddressEqual, toHex, type Hash, type Hex } from 'viem';
import { ITEMS, SHOP_NAME, itemLabel, type ItemKey } from './constants';
import { SHOP } from './deployments';
import { chain } from './chain';

export type PaymentRequest = {
  orderId: Hex; // 32 random bytes; passed to tryPay
  shop: Hex;
  shopName: typeof SHOP_NAME;
  item: ItemKey;
  itemLabel: string;
  amount: string; // tUSD base units (6 dec)
  rail: 'card' | 'qris';
  createdAt: number;
};

export const newOrderId = (): Hex => toHex(crypto.getRandomValues(new Uint8Array(32)));

export function newRequest(item: ItemKey, amount: bigint, rail: 'card' | 'qris'): PaymentRequest {
  return {
    orderId: newOrderId(),
    shop: SHOP,
    shopName: SHOP_NAME,
    item,
    itemLabel: itemLabel(item),
    amount: amount.toString(),
    rail,
    createdAt: Date.now(),
  };
}

// Validates anything that arrives from a URL, a QR or another tab.
const schema = z.object({
  o: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  s: z.string().refine((s) => isAddress(s) && isAddressEqual(s, SHOP), 'unregistered shop'),
  a: z.string().regex(/^\d{1,12}$/).refine((a) => BigInt(a) > 0n),
  i: z.enum([...(Object.keys(ITEMS) as (keyof typeof ITEMS)[]), 'custom']),
  r: z.enum(['card', 'qris']),
  c: z.coerce.number().refine((c) => c === chain.id, 'wrong chain'),
});

export const requestQuery = (r: PaymentRequest) =>
  new URLSearchParams({ o: r.orderId, s: r.shop, a: r.amount, i: r.item, r: r.rail, c: String(chain.id) }).toString();

export const requestUrl = (r: PaymentRequest, origin: string) => `${origin}/card/pay?${requestQuery(r)}`;

export function parseRequest(params: URLSearchParams): PaymentRequest | null {
  const p = schema.safeParse(Object.fromEntries(params));
  if (!p.success) return null;
  return {
    orderId: p.data.o as Hex,
    shop: p.data.s as Hex,
    shopName: SHOP_NAME,
    item: p.data.i,
    itemLabel: itemLabel(p.data.i),
    amount: p.data.a,
    rail: p.data.r,
    createdAt: Date.now(),
  };
}

// Terminal ↔ phone messaging. BroadcastChannel reaches other tabs and same-origin iframes (/demo);
// local listeners cover the sending document itself.
export type BusMessage =
  | { type: 'request'; request: PaymentRequest }
  | { type: 'cancel'; orderId: Hex }
  | { type: 'sent'; orderId: Hex; txHash: Hash; ms: number };

const listeners = new Set<(m: BusMessage) => void>();
let channel: BroadcastChannel | null = null;

function ch() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('cuanlater');
    channel.onmessage = (e) => {
      const m = e.data as BusMessage;
      if (m.type === 'request') {
        // re-validate: other tabs are a trust boundary too
        const r = parseRequest(new URLSearchParams(requestQuery(m.request)));
        if (!r) return;
        listeners.forEach((l) => l({ type: 'request', request: { ...r, createdAt: m.request.createdAt } }));
      } else listeners.forEach((l) => l(m));
    };
  }
  return channel;
}

export function post(m: BusMessage) {
  ch()?.postMessage(m);
  listeners.forEach((l) => l(m));
}

export function subscribe(fn: (m: BusMessage) => void) {
  ch();
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
