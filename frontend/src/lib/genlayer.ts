import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

export { TransactionStatus, ExecutionResult };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found");
  const client = createClient({
    chain: studionet,
    account: accounts[0] as `0x${string}`,
    provider: eth,
  });
  await (client as any).connect("studionet");
  return accounts[0];
}

function getClient(walletAddress?: string) {
  if (typeof window !== "undefined" && (window as any).ethereum && walletAddress) {
    return createClient({
      chain: studionet,
      account: walletAddress as `0x${string}`,
      provider: (window as any).ethereum,
    });
  }
  return createClient({ chain: studionet });
}

export async function readContract(address: `0x${string}`, functionName: string, args: any[] = [], walletAddress?: string) {
  const client = getClient(walletAddress);
  const result = await (client as any).readContract({
    address,
    functionName,
    args,
  });
  console.log("readContract result:", JSON.stringify(result));
  return result;
}

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
  });
  const hash = await (client as any).writeContract({
    address: contractAddress,
    functionName,
    args,
    value: BigInt(0),
  });
  return hash as string;
}

export async function waitForTx(hash: string) {
  const client = createClient({ chain: studionet });
  const receipt = await (client as any).waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 5000,
  });
  return receipt;
}
