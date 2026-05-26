import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

export { TransactionStatus, ExecutionResult };

export const SCENARIO_ADDRESS = (process.env.NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SUBMISSION_ADDRESS = (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS || "") as `0x${string}`;
export const SCORING_ADDRESS = (process.env.NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS || "") as `0x${string}`;

const STUDIO_RPC = "https://studio.genlayer.com:8443/api";

function getReadClient() {
  return createClient({ chain: studionet });
}

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

// Read directly via JSON-RPC — genlayer-js readContract returns {} on studionet
export async function readContract(address: `0x${string}`, functionName: string, args: any[] = []) {
  const payload = {
    jsonrpc: "2.0",
    method: "gen_call",
    id: Date.now(),
    params: [
      {
        to: address,
        data: JSON.stringify({ method: functionName, args }),
      },
      "latest",
    ],
  };
  const res = await fetch(STUDIO_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  console.log("readContract RPC response:", JSON.stringify(json));
  if (json.error) throw new Error(json.error.message || "RPC error");
  const result = json.result;
  if (result === null || result === undefined) return {};
  if (typeof result === "string") {
    try { return JSON.parse(result); } catch { return result; }
  }
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
  const client = getReadClient();
  const receipt = await (client as any).waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    retries: 120,
    interval: 5000,
  });
  return receipt;
}
