import type { Address } from 'viem';

// Filled from deployments/<chainId>.json (forge script prints the lines to paste).
export const CUANLATER = process.env.NEXT_PUBLIC_CUANLATER_ADDRESS as Address;
export const USD = process.env.NEXT_PUBLIC_USD_ADDRESS as Address;
export const STOCK = process.env.NEXT_PUBLIC_STOCK_ADDRESS as Address;
export const SHOP = process.env.NEXT_PUBLIC_SHOP_ADDRESS as Address;
