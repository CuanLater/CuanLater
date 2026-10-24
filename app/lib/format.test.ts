// node --test lib/format.test.ts  (Node 24 strips types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usd, usdDown, shares, idr, parseUsd, pct, change } from './format.ts';

test('demo numbers format as in specs/00-overview.md', () => {
  assert.equal(usd(3_015000n), '$3.02');
  assert.equal(usd(3_517500n), '$3.52');
  assert.equal(usd(13_567500n), '$13.57');
  assert.equal(usd(3_567500n), '$3.57');
  assert.equal(usdDown(6_985000n), '$6.98');
  assert.equal(usdDown(6_482500n), '$6.48');
  assert.equal(usd(40_482499n), '$40.48');
  assert.equal(shares(79943181818181819n), '0.0799');
  assert.equal(shares(920056818181818181n), '0.9201');
  assert.equal(shares(10n ** 18n), '1.0000');
  assert.equal(idr(3_000000n), '≈ Rp 48.000');
  assert.equal(pct(880n), '8.8%');
  assert.equal(change(44_000000n, 40_000000n), '+10.00%');
  assert.equal(parseUsd('3.5'), 3_500000n);
  assert.equal(parseUsd('abc'), null);
});
