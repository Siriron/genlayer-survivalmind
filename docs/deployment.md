# SurvivalMind — Deployment Guide

Full step-by-step guide for deploying SurvivalMind contracts and frontend to GenLayer Testnet Bradbury and Vercel.

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- `genvm-linter` installed: `pip install genvm-linter`
- MetaMask with GenLayer Testnet Bradbury configured
- GEN tokens from the testnet faucet: https://faucet.genlayer.foundation
- A Vercel account

---

## Step 1 — Lint the Contracts

Before deploying, verify all three contracts pass the linter.

```bash
genvm-lint check contracts/scenario.py
genvm-lint check contracts/submission.py
genvm-lint check contracts/scoring.py
```

All three must exit with code 0. Fix any errors before proceeding. Never deploy a contract that fails lint.

---

## Step 2 — Deploy Contracts via Studio

Go to [studio.genlayer.com](https://studio.genlayer.com).

Connect your MetaMask wallet to GenLayer Testnet Bradbury (Studionet).

For each of the three contracts, follow these steps:

1. Click **Upload Contract** (do not paste — upload the `.py` file directly)
2. Set the constructor parameter `game_name` to `"SurvivalMind"`
3. Click **Deploy**
4. Wait for the transaction to be accepted
5. Copy the **contract address** and **transaction URL** from the explorer

Deploy in this order:

1. `scenario.py` → copy address as `SCENARIO_ADDRESS`
2. `submission.py` → copy address as `SUBMISSION_ADDRESS`
3. `scoring.py` → copy address as `SCORING_ADDRESS`

---

## Step 3 — Verify Deployments

After each deployment, verify on [explorer-studio.genlayer.com](https://explorer-studio.genlayer.com):

- Transaction status: Accepted
- Contract address is visible
- Constructor call succeeded

---

## Step 4 — Configure Frontend Environment

In the `frontend/` directory, copy the example env file:

```bash
cp .env.example .env
```

Fill in the contract addresses from Step 2:

```
NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS=0xYourScenarioAddress
NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS=0xYourSubmissionAddress
NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS=0xYourScoringAddress
```

---

## Step 5 — Run Locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Test the full game flow:
1. Connect MetaMask
2. Click "Generate Scenario" — verify a scenario appears on-chain
3. Write a survival plan and submit
4. Verify the AI score appears
5. Check the leaderboard updates

---

## Step 6 — Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
cd frontend
vercel --prod
```

When prompted, set environment variables:
- `NEXT_PUBLIC_SCENARIO_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_SUBMISSION_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_SCORING_CONTRACT_ADDRESS`

### Option B — Vercel Dashboard (GitHub import)

1. Push the repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Set **Root Directory** to `frontend`
5. Add all three environment variables under **Environment Variables**
6. Click **Deploy**

After deployment, copy the Vercel URL (e.g. `survivalmind.vercel.app`).

---

## Step 7 — Test the Live Deployment

1. Open the Vercel URL in a browser with MetaMask installed
2. Connect wallet
3. Generate a scenario — confirm a transaction goes to GenLayer
4. Submit a plan — confirm two transactions (submission + scoring)
5. Verify scores and leaderboard appear
6. Check [explorer-studio.genlayer.com](https://explorer-studio.genlayer.com) that all transactions are accepted

---

## Contract Addresses Reference

After deployment, record all addresses here:

| Contract | Address | Explorer TX |
|---|---|---|
| scenario.py | | |
| submission.py | | |
| scoring.py | | |

---

## Troubleshooting

**MetaMask shows wrong network**
The frontend calls `client.connect("testnetBradbury")` before every write. If MetaMask rejects, manually add GenLayer Testnet Bradbury to MetaMask: RPC and Chain ID available at [docs.genlayer.com](https://docs.genlayer.com).

**Transaction times out**
GenLayer validator consensus can take 30–120 seconds. The frontend retries up to 60 times at 5-second intervals. Wait it out before assuming failure.

**Scoring returns execution error**
Check that the scenario JSON passed to `score_plan` is valid. The scoring contract parses it inline in the prompt. If the scenario generation was incomplete, regenerate the scenario first.

**Lint error E025/E026**
Storage writes inside `leader_fn`. Restructure so all `self.X = ...` assignments happen after `gl.run_nondet_unsafe` returns, never inside `leader_fn` or `validator_fn`.

---

## Notes

- All three contracts use `game_name: str` as their constructor parameter so GenLayer Studio prompts for input on deploy.
- `refresh()` is implemented on all contracts as required by the platform.
- The `run_nondet_unsafe` pattern with `validator_fn` is used on all LLM calls that produce scored outputs, ensuring multi-validator consensus.
- No ETH, no token transfers, no financial logic. Pure utility contracts.
