'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useCard, pending } from '@/components/card-context';
import { useWallet } from '@/lib/wallet';
import { parseRequest, post, requestUrl } from '@/lib/requests';
import { fee } from '@/lib/constants';
import { groups4, idr, idrPlain, last4, shares, usd, usdDown } from '@/lib/format';
import { railOf } from '@/lib/rails';
import { Button, Chip, LinkButton, Note, Row, Rows } from '@/components/ui';

/** Boards 3 · Shop asks, you approve and 3b · QRIS request */
export default function Pay() {
  const params = useSearchParams();
  const req = parseRequest(params);
  const { address, view: v } = useCard();
  const wallet = useWallet();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(location.origin);
    setScanned(false);
    const t = setTimeout(() => setScanned(true), 1000); // simulated scan, no camera
    return () => clearTimeout(t);
  }, [req?.orderId]);

  if (!req) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <h1 className="text-xl font-bold">This payment link isn&apos;t valid</h1>
        <p className="text-sm text-ink-2">It may be for another shop or network. Nothing was charged.</p>
        <LinkButton href="/card">Back to my card</LinkButton>
      </div>
    );
  }

  const amount = BigInt(req.amount);
  const borrowed = amount + fee(amount);
  const qris = req.rail === 'qris';

  const approve = async () => {
    setBusy(true);
    setError('');
    const t0 = performance.now();
    try {
      const receipt = await wallet.send('tryPay', [req.shop, amount, railOf(req.rail), req.orderId]);
      const ms = Math.round(performance.now() - t0);
      post({ type: 'sent', orderId: req.orderId, txHash: receipt.transactionHash, ms });
      pending.set(null);
      router.push(`/card/result/${req.orderId}?tx=${receipt.transactionHash}&ms=${ms}&i=${req.item}`);
    } catch (e) {
      setError((e as { shortMessage?: string })?.shortMessage ?? (e as Error).message);
      setBusy(false);
    }
  };
  const decline = () => {
    post({ type: 'cancel', orderId: req.orderId });
    pending.set(null);
    router.push('/card');
  };

  const common = (
    <Rows>
      <Row label="Borrowed against your stock" sub="Includes 0.5% fee" value={`≈ ${usd(borrowed)}`} />
      <Row label="Stock sold" value="0 tNVDA" />
      <Row label={qris ? 'You will owe in total' : 'You will owe'} value={usd(v.debt + borrowed)} />
      <Row label="Borrowing left today" value={usdDown(v.available - borrowed)} />
    </Rows>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        {qris ? (
          <>
            <Chip tone="info">Scanned via QRIS · Kantin Blitz</Chip>
            <Chip>Simulated scan</Chip>
          </>
        ) : (
          <Chip tone="info">Paid via Cuan Card Visa •••• {last4(address)}</Chip>
        )}
      </header>

      {qris && (
        <div>
          <div className="relative mx-auto grid h-[170px] place-items-center overflow-hidden rounded-card bg-card">
            {!scanned ? (
              <>
                <div className="rounded bg-white p-1.5">
                  {origin && <QRCodeSVG value={requestUrl(req, origin)} size={110} />}
                </div>
                <Brackets />
                <div className="scan-line absolute top-2 right-10 left-10 h-0.5 bg-ok-solid" />
              </>
            ) : (
              <div className="px-4 text-center text-sm font-semibold text-white">
                <span aria-hidden className="text-ok-solid">✓ </span>
                QRIS merchant verified: Kantin Blitz ({usd(amount)} / ≈ Rp {idrPlain(amount)})
              </div>
            )}
          </div>
          <p className="mt-1 text-center text-xs text-ink-3">Simulated scan · 1 s</p>
        </div>
      )}

      <div>
        <div className="text-sm text-ink-2">Kantin Blitz asks for</div>
        <div className="text-4xl font-bold">{usd(amount)}</div>
        <div className="text-sm text-ink-2">
          {req.itemLabel} · {qris ? idr(amount) : 'card tap'}
        </div>
      </div>

      {!qris && (
        <div className="rounded-card border border-line bg-raised p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Kantin Blitz</span>
            <Chip tone="ok">Verified shop</Chip>
          </div>
          <div className="mt-1 font-mono text-xs break-all text-ink-3">{groups4(req.shop)}</div>
        </div>
      )}

      {common}

      {!qris && (
        <Note tone="info">
          Your {v.shares === 10n ** 18n ? '1' : shares(v.shares)} tNVDA stays locked, not sold. Pay the {usd(v.debt + borrowed)} back later:
          from profit, with cash, or with a little stock. No deadline while your loan is safe.
        </Note>
      )}

      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Button onClick={approve} disabled={busy || (qris && !scanned)}>
          {busy ? 'Paying…' : qris ? `Approve ${usd(amount)} via QRIS` : `Approve ${usd(amount)} card tap`}
        </Button>
        <Button variant={qris ? 'ghost' : 'secondary'} onClick={decline} disabled={busy}>
          Decline
        </Button>
      </div>
    </div>
  );
}

function Brackets() {
  const c = 'absolute size-6 border-ok-solid';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-6 mx-auto w-[150px]">
      <span className={`${c} top-0 left-0 border-t-4 border-l-4`} />
      <span className={`${c} top-0 right-0 border-t-4 border-r-4`} />
      <span className={`${c} bottom-0 left-0 border-b-4 border-l-4`} />
      <span className={`${c} right-0 bottom-0 border-r-4 border-b-4`} />
    </div>
  );
}
