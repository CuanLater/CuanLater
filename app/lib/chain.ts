import { createPublicClient, defineChain, fallback, http } from 'viem';
import { monadTestnet } from 'viem/chains';

const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const rpc = process.env.NEXT_PUBLIC_RPC_URL || monadTestnet.rpcUrls.default.http[0];
const rpcFallback = process.env.NEXT_PUBLIC_RPC_FALLBACK_URL || monadTestnet.rpcUrls.default.http[0];

export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.monadexplorer.com';
export const isLocal = id === 31337;

export const chain = defineChain({
  ...(id === monadTestnet.id ? monadTestnet : {}),
  id,
  name: isLocal ? 'Anvil' : 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: { default: { name: 'Explorer', url: EXPLORER_URL } },
});

// Public RPC is rate-limited: never poll faster than 500 ms.
export const publicClient = createPublicClient({
  chain,
  transport: fallback([http(rpc), http(rpcFallback)]),
  pollingInterval: 500,
});

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
