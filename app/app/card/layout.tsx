'use client';

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseAbiItem } from 'viem';
import { useWallet } from '@/lib/wallet';
import { useAccountView, type AccountView } from '@/lib/hooks';
import { CardCtx, pending } from '@/components/card-context';
import { requestQuery, subscribe } from '@/lib/requests';
import { publicClient } from '@/lib/chain';
import { CUANLATER } from '@/lib/deployments';
import { Join } from '@/components/join';

const profitEvent = parseAbiItem(
  'event ProfitRepaid(address indexed user, uint256 paid, uint256 sharesSold, uint256 price, uint256 debtAfter)',
);

export default function CardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const { view, refresh } = useAccountView(wallet.address);
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  const [joinError, setJoinError] = useState('');
  const joining = useRef(false);

  // Terminal → phone: open the request sheet immediately; close it on cancel.
  useEffect(
    () =>
      subscribe((m) => {
        if (m.type === 'request') {
          pending.set(m.request);
          router.push(`/card/pay?${requestQuery(m.request)}`);
        } else if (m.type === 'cancel' && path === '/card/pay' && search.get('o') === m.orderId) {
          pending.set(null);
          router.push('/card');
        }
      }),
    [router, path, search],
  );

  // After login, join automatically.
  useEffect(() => {
    if (!wallet.address || !view || view.joined || joining.current) return;
    joining.current = true;
    wallet
      .send('join')
      .then(() => refresh())
      .catch((e) => setJoinError(e?.shortMessage ?? e?.message ?? 'Could not join'))
      .finally(() => (joining.current = false));
  }, [wallet, view, refresh]);

  // Bayar pakai cuan: when debt and shares both drop, look for our ProfitRepaid and show it.
  const prev = useRef<AccountView | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!p || !view || !wallet.address || (path === '/card/profit' && search.get('tx'))) return;
    if (view.debt < p.debt && view.shares < p.shares) {
      publicClient.getBlockNumber().then((n) =>
        publicClient
          .getLogs({ address: CUANLATER, event: profitEvent, args: { user: wallet.address }, fromBlock: n > 20n ? n - 20n : 0n })
          .then((logs) => {
            const l = logs.at(-1);
            if (l) router.push(`/card/profit?tx=${l.transactionHash}`);
          }, () => {}),
      );
    }
  }, [view, wallet.address, path, search, router]);

  let body: ReactNode;
  if (path === '/card/safety') body = children;
  else if (!wallet.ready) body = <Center>Loading…</Center>;
  else if (!wallet.address) body = <Join />;
  else if (!view) body = <Center>Loading your card…</Center>;
  else if (!view.joined)
    body = (
      <Center>
        {joinError ? (
          <span className="text-bad">{joinError}</span>
        ) : (
          'Setting up your Cuan Card: locking 1 tNVDA as your guarantee…'
        )}
      </Center>
    );
  else body = <CardCtx.Provider value={{ address: wallet.address, view, refresh }}>{children}</CardCtx.Provider>;

  return <main className="mx-auto min-h-dvh w-full max-w-[420px] px-4 pt-4 pb-8">{body}</main>;
}

function Center({ children }: { children: ReactNode }) {
  return (
    <p className="grid min-h-[60dvh] place-items-center text-center text-sm text-ink-2" aria-live="polite">
      {children}
    </p>
  );
}
