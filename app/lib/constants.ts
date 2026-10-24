// Shared values from specs/00-overview.md. Keep in sync with contracts/src/CuanLater.sol.
export const FEE_BPS = 50n;
export const WEEKDAY_LIMIT_BPS = 3500n;
export const WEEKEND_LIMIT_BPS = 2500n;
export const CAREFUL_BPS = 3500n;
export const LIQUIDATION_BPS = 5000n;
export const TARGET_BPS = 3500n;
export const IDR_PER_USD = 16_000;
export const SHOP_NAME = 'Kantin Blitz';
export const NMID_LABEL = 'ID102026MONAD';
export const START_PRICE = 40_000000n;

export const ITEMS = {
  coffee: { label: 'Coffee', amount: 3_000000n },
  'es-teh': { label: 'Es teh', amount: 500000n },
  sticker: { label: 'Sticker', amount: 5_000000n },
  't-shirt': { label: 'T-shirt', amount: 10_000000n },
} as const;
export type ItemKey = keyof typeof ITEMS | 'custom';

export const itemLabel = (i: string) => (i in ITEMS ? ITEMS[i as keyof typeof ITEMS].label : 'Payment');
export const fee = (amount: bigint) => (amount * FEE_BPS) / 10_000n;
