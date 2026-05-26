import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

export { TransactionStatus, ExecutionResult };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

// Lazy read client — created only in browser to avoid SSR issues
function getReadClient() {
  return createClient({ chain: testnetBradbury });
}

export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found");
  return accounts[0];
}

export async function readContract(address: `0x${string}`, functionName: string, args: any[] = []) {
  const client = getReadClient();
  const result = await client.readContract({
    address,
    functionName,
    args,
  });
  return result;
}

export async function writeContract(
  walletAddress: string,
  contractAddress: `0x${string}`,
  functionName: string,
  args: any[]
): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const client = createClient({
    chain: testnetBradbury,
    account: walletAddress as `0x${string}`,
    provider: (window as any).ethereum,
  });
  await client.connect("testnetBradbury");
  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
    value: 0n,
  });
  return hash as string;
}

export async function waitForTx(hash: string) {
  const client = getReadClient();
  const receipt = await (client as any).waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 120,
    interval: 5000,
  });
  return receipt;
}
