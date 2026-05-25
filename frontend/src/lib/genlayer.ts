import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

export { TransactionStatus, ExecutionResult };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

export const readClient = createClient({ chain: testnetBradbury });

export function getWriteClient(address: string) {
  if (typeof window === "undefined") throw new Error("Write client only available in browser");
  return createClient({
    chain: testnetBradbury,
    account: address as `0x${string}`,
    provider: (window as Window & { ethereum?: unknown }).ethereum,
  });
}

export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const eth = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found");
  const client = getWriteClient(accounts[0]);
  await client.connect("testnetBradbury");
  return accounts[0];
}

export async function readContract(address: `0x${string}`, functionName: string, args: any[] = []) {
  const result = await readClient.readContract({
    address,
    functionName,
    args,
    stateStatus: "accepted",
  });
  return result;
}

export async function writeContract(
  walletAddress: string,
  contractAddress: `0x${string}`,
  functionName: string,
  args: any[]
): Promise<string> {
  const client = getWriteClient(walletAddress);
  const hash = await client.writeContract({
    address: contractAddress,
    functionName,
    args,
    value: BigInt(0),
  });
  return hash;
}

export async function waitForTx(hash: string) {
  const receipt = await readClient.waitForTransactionReceipt({
    hash: hash as `0x${string}`,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 5000,
  });
  return receipt;
}
