import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover disabled:opacity-50',
  secondary: 'border border-line-2 bg-raised text-ink hover:bg-sunken disabled:opacity-50',
  ghost: 'text-ink-2 underline underline-offset-2 hover:text-ink',
  danger: 'bg-bad-solid text-white disabled:opacity-50',
};
const btn = 'inline-flex min-h-11 w-full items-center justify-center rounded-[10px] px-4 text-[15px] font-semibold transition-colors';

export function Button({ variant = 'primary', className = '', ...p }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button className={`${btn} ${variants[variant]} ${className}`} {...p} />;
}

export function LinkButton({ variant = 'primary', className = '', ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${btn} no-underline ${variants[variant]} ${className}`} {...p} />;
}

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'dark';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  dark: 'bg-white/10 text-white',
};

export function Chip({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line rounded-card border border-line bg-raised">{children}</dl>;
}

export function Row({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <dt className="text-sm text-ink-2">
        {label}
        {sub && <div className="text-xs text-ink-3">{sub}</div>}
      </dt>
      <dd className="text-right text-sm font-semibold">{value}</dd>
    </div>
  );
}

export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <p className={`rounded-card px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>{children}</p>;
}

export function Mark() {
  return (
    <span className="flex items-center gap-2 font-bold">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-card text-sm text-white">C</span>
      CuanLater
    </span>
  );
}

export function Contactless({ className = 'size-6' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M8.5 8.5a5 5 0 0 1 0 7" />
      <path d="M12 6a8.5 8.5 0 0 1 0 12" />
      <path d="M15.5 3.5a12 12 0 0 1 0 17" />
    </svg>
  );
}
