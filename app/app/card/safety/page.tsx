import { HealthBar } from '@/components/card';
import { Chip, LinkButton, Note, Row, Rows } from '@/components/ui';

/** Board 8 · Big crash: safety sell (static Budi example) */
export default function Safety() {
  return (
    <div className="space-y-4">
      <Chip tone="warn">Example · Budi</Chip>
      <h1 className="text-2xl font-bold">What if the price crashes?</h1>
      <Rows>
        <Row label="Borrowed" value="$10.00 on $40.00" />
        <Row label="tNVDA price" value="$22.00 (−45%)" />
        <Row label="Debt vs stock" value="45.7% · Careful" />
      </Rows>
      <div className="rounded-card border border-line bg-raised p-4">
        <HealthBar health={4570n} marker />
        <p className="mt-2 text-sm">Auto-sell starts below ≈ $20.10 of stock</p>
      </div>
      <Note tone="warn">At 50%, the app sells just enough stock to make the loan safe again. Never everything at once.</Note>
      <Note>A coffee is very safe: $3.02 owed on $40.00 of stock is only touched if the price falls about 85%.</Note>
      <div className="space-y-2">
        <LinkButton href="/card/repay">Pay some back to stay safe</LinkButton>
        <LinkButton variant="secondary" href="/card">
          Start over
        </LinkButton>
      </div>
    </div>
  );
}
