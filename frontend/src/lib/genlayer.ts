import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export { TransactionStatus };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

// Normalize any thrown value into a readable string
export function extractError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, any>;
    // genlayer-js throws plain objects with message, shortMessage, or details
    return obj.message || obj.shortMessage || obj.details || obj.reason || JSON.stringify(e);
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

// Read — no wallet needed
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

// Write — needs wallet + connect (no args to connect, no value field)
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
  // connect() takes no arguments in genlayer-js ^1.1.7
  await (client as any).connect();
  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
  } as any);
  return hash as string;
}

export async function waitForTx(hash: string): Promise<any> {
  const client = createClient({ chain: studionet });
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as any,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 120,
  } as any);
  return receipt;
}
