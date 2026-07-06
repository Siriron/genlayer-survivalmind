# SurvivalMind — Deployment Guide

Full deployment reference for SurvivalMind on GenLayer Studionet.

---

## Deployed Contracts

| Contract | Address | Deploy TX |
|---|---|---|
| scenario.py | 0xBB92C508DbaFa1bC2AbfeEc0a462540f68e9f171 | https://explorer-studio.genlayer.com/tx/0xde7c88b686a10cb757b19fbbe6c595d6090021bfc5d14fde5510a3a073c36ef5 |
| submission.py | 0xa757Ce65c4F9c82B780C998479B7a079D98f66D4 | https://explorer-studio.genlayer.com/tx/0x6039f9604cbf0d60e41f241666cf73ad555339ec933921f892b24095867a49d9 |
| scoring.py | 0xa6d7E7fcB2CfE673ACb1757293392bea042985fA | https://explorer-studio.genlayer.com/tx/0x0510673dbbc8774194be01df6af2d9bd457dd0bfe02fc18bcc5310c6b9bbbc67 |

**Live app:** https://genlayer-survivalmind.vercel.app/

**Explorer:** https://explorer-studio.genlayer.com

---

## Prerequisites

- MetaMask with GenLayer Studionet configured
- GEN tokens from the testnet faucet: https://faucet.genlayer.foundation
- Node.js 18+
- A Vercel account

---

## Deploying New Contracts

If redeploying from scratch, follow these steps for each contract.

### Step 1 — Open Studio

Go to https://studio.genlayer.com and connect your MetaMask wallet.

### Step 2 — Upload Contract

For each of the three contracts:

1. Click **Upload Contract** — upload the `.py` file directly, never paste
2. Set the constructor parameter `game_name` to `"SurvivalMind"`
3. Click **Deploy**
4. Wait for the transaction to reach FINALIZED status
5. Copy the contract address and transaction URL from the explorer

Deploy in this order:

1. `scenario.py` — copy address as `SCENARIO_ADDRESS`
2. `submission.py` — copy address as `SUBMISSION_ADDRESS`
3. `scoring.py` — copy address as `SCORING_ADDRESS`

### Step 3 — Verify on Explorer

After each deployment, check https://explorer-studio.genlayer.com:

- Transaction status: Finalized
- GENVM Result: Success
- Contract address is visible

---

## Frontend Environment

The frontend reads contract addresses from environment variables.

### Local Development

```bash
cd frontend
cp .env.example .env
```

Fill in `.env`:

```
NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS=0xBB92C508DbaFa1bC2AbfeEc0a462540f68e9f171
NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS=0xa757Ce65c4F9c82B780C998479B7a079D98f66D4
NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS=0xa6d7E7fcB2CfE673ACb1757293392bea042985fA
```

Then run:

```bash
npm install
npm run dev
```

### Vercel Deployment

1. Go to https://vercel.com/new → Import `genlayer-survivalmind`
2. Set **Root Directory** to `frontend`
3. Add environment variables:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS` | `0xBB92C508DbaFa1bC2AbfeEc0a462540f68e9f171` |
| `NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS` | `0xa757Ce65c4F9c82B780C998479B7a079D98f66D4` |
| `NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS` | `0xa6d7E7fcB2CfE673ACb1757293392bea042985fA` |

4. Click **Deploy**

---

## Testing After Deployment

### Test Contract Directly in Studio

Before testing the frontend, verify each contract works in Studio:

1. Go to https://studio.genlayer.com → open scenario contract
2. Go to **Write Contract** tab
3. Call `generate_scenario` with `round_id = "test1"`
4. Wait for FINALIZED status
5. Go to **Read Contract** tab
6. Call `get_scenario` with `round_id = "test1"`
7. Confirm the scenario JSON is returned

### Test Full Frontend Flow

1. Open https://genlayer-survivalmind.vercel.app/
2. Connect MetaMask — confirm wallet badge appears
3. Click **Generate Scenario** — MetaMask will prompt, confirm
4. Wait 1-3 minutes for AI consensus
5. Write a survival plan (minimum 20 characters)
6. Click **Submit to AI Judge** — two transactions will be sent
7. Wait for scoring consensus
8. Verify score and feedback appear
9. Check leaderboard updates

---

## Contract Design Notes

All three contracts use the pinned dependency:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

LLM calls use the equivalence principle for multi-validator consensus. Raw LLM
output is never byte-identical across validators, so `non_comparative` is used
instead of `strict_eq` — each validator independently accepts its own result:

```python
def nondet() -> str:
    result = gl.nondet.exec_prompt(task).replace("```json", "").replace("```", "")
    return json.dumps(json.loads(result), sort_keys=True)

result_str = gl.eq_principle.non_comparative(nondet)
```

All contracts implement `refresh()` as required. Write functions return `typing.Any`. Storage writes always happen outside the `nondet()` block.

---

## Troubleshooting

**Transaction reverted at consensus contract**
The frontend is connecting to the wrong network. Ensure `studionet` is used everywhere, not `testnetBradbury`.

**Contract ERROR on explorer**
Check the stderr in the transaction detail. Common causes: wrong dependency hash, API function not found, storage write inside nondet block.

**readContract returns empty object**
The contract state may not be readable immediately after finalization. The frontend polls up to 20 times at 4-second intervals. If it still fails, check the explorer to confirm the write transaction succeeded.

**MetaMask UnauthorizedProviderError**
Call `eth_requestAccounts` before creating the write client. The frontend handles this automatically.

**Transaction timeout in Mises browser**
GenLayer consensus takes 1-3 minutes. The Mises browser built-in wallet may time out. Use the standalone MetaMask app if possible.
