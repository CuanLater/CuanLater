'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PrivyProvider, useCreateWallet, useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { SmartWalletsProvider, useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { createWalletClient, encodeFunctionData, http, toHex, type Address, type Hex, type TransactionReceipt } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { cuanLaterAbi } from './abi';
import { chain, isLocal, publicClient } from './chain';
import { CUANLATER } from './deployments';

type Wallet = {
  ready: boolean;
  address?: Address;
  mode: 'privy' | 'local';
  /** Sends the email OTP. Returns 'done' when no code is needed (local mode). */
  sendCode(email: string): Promise<'code' | 'done'>;
  verify(code: string): Promise<void>;
  logout(): void;
  /** Calls a CuanLater function from the user's wallet (gas sponsored) and waits for the receipt. */
  send(functionName: string, args?: readonly unknown[]): Promise<TransactionReceipt>;
};

const Ctx = createContext<Wallet | null>(null);
export const useWallet = () => useContext(Ctx)!;

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const wait = (hash: Hex) => publicClient.waitForTransactionReceipt({ hash });
const data = (functionName: string, args: readonly unknown[]) =>
  encodeFunctionData({ abi: cuanLaterAbi, functionName: functionName as never, args: args as never });

export function WalletProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <LocalWallet>{children}</LocalWallet>;
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ['email'],
        defaultChain: chain,
        supportedChains: [chain],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' }, showWalletUIs: false },
      }}
    >
      <SmartWalletsProvider>
        <PrivyWallet>{children}</PrivyWallet>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}

// Plan A (specs/03-offchain.md): Privy email OTP + smart wallet; gas paid by the paymaster set in the Privy dashboard.
function PrivyWallet({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { client } = useSmartWallets();
  const { user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const creating = useRef(false);
  // createOnLogin can be skipped (e.g. a login interrupted by RPC errors); without an embedded
  // wallet there is no smart wallet, so create it ourselves once.
  const hasEmbedded = !!user?.linkedAccounts.some((a) => a.type === 'wallet' && a.walletClientType === 'privy');
  useEffect(() => {
    if (!ready || !authenticated || !user || hasEmbedded || creating.current) return;
    creating.current = true;
    createWallet().catch((e) => {
      console.error('[cuanlater] could not create embedded wallet', e);
      creating.current = false;
    });
  }, [ready, authenticated, user, hasEmbedded, createWallet]);
  const value = useMemo<Wallet>(
    () => ({
      mode: 'privy',
      ready: ready && (!authenticated || !!client),
      address: authenticated ? client?.account.address : undefined,
      sendCode: async (email) => (await sendCode({ email }), 'code'),
      verify: (code) => loginWithCode({ code }),
      logout: () => void logout(),
      send: async (fn, args = []) => {
        if (!client) throw new Error('Wallet is still loading');
        return wait(await client.sendTransaction({ to: CUANLATER, data: data(fn, args) }));
      },
    }),
    [ready, authenticated, client, sendCode, loginWithCode, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// shortcut: burner key in localStorage, used only when NEXT_PUBLIC_PRIVY_APP_ID is empty (local anvil dev).
const KEY = 'cuanlater.burner';
function LocalWallet({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<Hex | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => {
      try {
        setKey(localStorage.getItem(KEY) as Hex | null);
      } catch {}
    };
    load();
    setReady(true);
    // /demo: a login inside the phone iframe reaches the outer page too
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);
  const value = useMemo<Wallet>(() => {
    const account = key ? privateKeyToAccount(key) : undefined;
    const wc = account && createWalletClient({ account, chain, transport: http(chain.rpcUrls.default.http[0]) });
    return {
      mode: 'local',
      ready,
      address: account?.address,
      sendCode: async () => {
        const k = generatePrivateKey();
        if (isLocal) {
          await publicClient.request({
            method: 'anvil_setBalance' as never,
            params: [privateKeyToAccount(k).address, toHex(10n ** 20n)] as never,
          });
        }
        localStorage.setItem(KEY, k);
        setKey(k);
        return 'done';
      },
      verify: async () => {},
      logout: () => {
        localStorage.removeItem(KEY);
        setKey(null);
      },
      send: async (fn, args = []) => {
        if (!wc) throw new Error('Not logged in');
        return wait(await wc.sendTransaction({ to: CUANLATER, data: data(fn, args) }));
      },
    };
  }, [key, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
