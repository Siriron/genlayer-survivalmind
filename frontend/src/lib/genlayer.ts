import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export { TransactionStatus };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

// JSON.stringify that never throws — BigInt (common in gas/value fields on
// wallet/RPC error objects) and circular refs (common on provider/request
// objects) both make plain JSON.stringify() throw, which previously meant
// extractError() itself could crash instead of returning a string.
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v
    );
  } catch {
    try {
      return String(value);
    } catch {
      return "Unknown error";
    }
  }
}

// Normalize any thrown value into a readable string.
// genlayer-js / MetaMask often throw plain EIP-1193 objects, not Error
// instances — plain objects have no custom toString(), so naive
// `${e}` or `"Error: " + e` interpolation renders literally as
// "[object Object]". Every field below is re-checked for type before
// being returned, since some SDKs nest another object (not a string)
// under `.message` or `.data`.
export function extractError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "bigint" || typeof e === "number" || typeof e === "boolean") {
    return String(e);
  }
  if (e instanceof Error) {
    // Some libraries attach a more specific nested error under `.cause`.
    const cause = (e as any).cause;
    if (cause && cause !== e) {
      const causeMsg = extractError(cause);
      if (causeMsg && causeMsg !== "Unknown error") return causeMsg;
    }
    return e.message || e.name || safeStringify(e);
  }
  if (Array.isArray(e)) {
    return e.map((item) => extractError(item)).join("; ");
  }
  if (typeof e === "object") {
    const obj = e as Record<string, any>;
    const candidates = [
      obj.message,
      obj.shortMessage,
      obj.details,
      obj.reason,
      obj.data?.message,
      obj.error?.message,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
      // A candidate can itself be a nested error-shaped object.
      if (candidate && typeof candidate === "object") {
        const nested = extractError(candidate);
        if (nested && nested !== "Unknown error") return nested;
      }
    }
    if (typeof obj.code !== "undefined") {
      return `Request failed (code ${obj.code}): ${safeStringify(obj)}`;
    }
    return safeStringify(e);
  }
  return String(e);
}

export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found");
  return accounts[0];
}

// Read client — no wallet needed per docs
export async function readContract(
  address: `0x${string}`,
  functionName: string,
  args: any[] = []
): Promise<any> {
  const client = createClient({ chain: studionet });
  const result = await client.readContract({
    address,
    functionName,
    args,
  } as any);
  console.log(`readContract ${functionName}:`, result);
  return result;
}

// Write client — MetaMask browser pattern:
//   createClient({ chain, account, provider })
//   writeContract({ ..., value: BigInt(0) })
// client.connect() is attempted as a best-effort chain switch only — see below.
export async function writeContract(
  walletAddress: string,
  contractAddress: `0x${string}`,
  functionName: string,
  args: any[]
): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const eth = (window as any).ethereum;
  await eth.request({ method: "eth_requestAccounts" });

  const client = createClient({
    chain: studionet,
    account: walletAddress as `0x${string}`,
    provider: eth,
  } as any);

  // Best-effort chain switch. This is NOT a documented genlayer-js method on
  // every SDK version — if it doesn't exist or rejects, we must not let that
  // kill the transaction, since client.writeContract() routes through the
  // `chain` config above regardless of MetaMask's active network. Swallowing
  // failures here (instead of throwing) is what previously turned an
  // unrelated/optional step into a hard failure surfaced to the player.
  try {
    if (typeof (client as any).connect === "function") {
      await (client as any).connect("studionet");
    }
  } catch (connectErr) {
    console.warn("client.connect(\"studionet\") skipped:", extractError(connectErr));
  }

  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
    value: BigInt(0),
  } as any);

  return hash as string;
}

// Wait for FINALIZED status, then check execution result.
// CRITICAL: A tx can be FINALIZED but still have FINISHED_WITH_ERROR execution —
// in that case the contract state was NOT modified, and any subsequent readContract
// will return the old (empty) value — causing "Scenario not found on chain" errors.
// Docs: always check receipt.txExecutionResultName before reading contract state.
export async function waitForTx(hash: string): Promise<any> {
  const client = createClient({ chain: studionet });
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as any,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 120,
  } as any);

  // txExecutionResultName is the string field on the receipt.
  // "FINISHED_WITH_RETURN" = success; anything else = the execution failed.
  // We compare by string so we don't depend on the exact enum export name.
  const execResult: string | undefined = (receipt as any).txExecutionResultName;
  console.log("txExecutionResultName:", execResult);

  if (execResult && execResult !== "FINISHED_WITH_RETURN") {
    throw new Error(
      `Contract execution failed (${execResult}). ` +
      `The TX was finalized but the contract returned an error. ` +
      `Hash: ${hash}`
    );
  }

  return receipt;
}
