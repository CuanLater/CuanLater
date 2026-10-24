// Profit keeper: on every block, harvests pages of members that have profit to pay their debt.
// Anyone may call harvestRange; this just does it so nobody has to press "Harvest now".
import { readFileSync, existsSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, formatUnits, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from 'viem/chains';
import { cuanLaterAbi } from '../app/lib/abi.ts';

const RPC_URL = process.env.RPC_URL!;
const KEY = process.env.KEEPER_PRIVATE_KEY as Hex;
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 10143);
const PAGE = 50n; // keep harvest batches at 50 or fewer
if (!RPC_URL || !KEY) throw new Error('Set RPC_URL and KEEPER_PRIVATE_KEY');

const file = new URL(`../deployments/${CHAIN_ID}.json`, import.meta.url);
const address = (process.env.CUANLATER_ADDRESS ??
  (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).cuanLater : undefined)) as Address;
if (!address) throw new Error('Set CUANLATER_ADDRESS or deploy first');

const chain = CHAIN_ID === monadTestnet.id
  ? monadTestnet
  : ({ id: CHAIN_ID, name: 'local', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } } as const);
// Public RPC allows 15 req/s per IP: poll once a second and fold the member reads into one multicall.
const pub = createPublicClient({ chain, transport: http(RPC_URL), pollingInterval: 1000, batch: { multicall: CHAIN_ID === monadTestnet.id } });
const wallet = createWalletClient({ chain, transport: http(RPC_URL), account: privateKeyToAccount(KEY) });
const c = { address, abi: cuanLaterAbi } as const;

const members: Address[] = [];
let busy = false;

async function tick(block: bigint) {
  if (busy) return; // never more than one transaction in flight
  busy = true;
  try {
    const n = await pub.readContract({ ...c, functionName: 'membersLength' });
    for (let i = BigInt(members.length); i < n; i++) members.push(await pub.readContract({ ...c, functionName: 'members', args: [i] }));
    const views = await Promise.all(members.map((m) => pub.readContract({ ...c, functionName: 'accountView', args: [m] })));
    // Pay "the moment it is enough": only when profit covers the whole debt, so one harvest sells
    // the fewest shares (demo: $3.52 at $44 → 0.0799 sold). The contract itself also allows partial pays.
    const due = views.flatMap((v, i) =>
      v.autoRepay && v.debt > 0n && v.value >= v.principal + v.debt ? [{ i: BigInt(i), paid: v.debt }] : [],
    );
    if (!due.length) return; // nothing harvestable: don't burn gas
    const from = (due[0].i / PAGE) * PAGE; // one page per block
    const page = due.filter((d) => d.i / PAGE === from / PAGE);
    // Monad charges the gas limit: send the estimate + 20% explicitly.
    const gas = await pub.estimateContractGas({ ...c, functionName: 'harvestRange', args: [from, PAGE], account: wallet.account });
    const hash = await wallet.writeContract({ ...c, functionName: 'harvestRange', args: [from, PAGE], gas: (gas * 12n) / 10n });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`${block} harvested ${page.length} users, paid $${formatUnits(page.reduce((x, d) => x + d.paid, 0n), 6)} (${hash})`);
  } catch (e) {
    console.error(`${block} keeper error:`, (e as Error).message);
  } finally {
    busy = false;
  }
}

console.log(`keeper watching ${address} on chain ${CHAIN_ID}`);
pub.watchBlockNumber({ onBlockNumber: tick, emitMissed: false });
