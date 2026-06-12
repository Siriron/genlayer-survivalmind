import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export { TransactionStatus };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

// Normalize any thrown value into a readable string.
// genlayer-js often throws plain objects, not Error instances.
export function extractError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, any>;
    return (
      obj.message ||
      obj.shortMessage ||
      obj.details ||
      obj.reason ||
      JSON.stringify(e)
    );
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

// Write client — MetaMask browser pattern per official docs:
//   createClient({ chain, account, provider })
//   await client.connect("studionet")   <-- docs require the network name string
//   writeContract({ ..., value: BigInt(0) })
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

  // Docs explicitly require passing the network name string to connect().
  // This switches MetaMask to the correct chain; without it the wallet may
  // be on the wrong network and writeContract will throw or silently fail.
  await (client as any).connect("studionet");

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
