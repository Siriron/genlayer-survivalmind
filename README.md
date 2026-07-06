# SurvivalMind

**AI-judged survival strategy game on GenLayer.**

SurvivalMind drops players into dynamically generated survival scenarios — arctic tundra, jungle, desert, flooded subway tunnels — and asks a single question: what would you do? Players submit their survival plan in plain text. GenLayer's multi-validator AI network evaluates each plan across three dimensions: resourcefulness, realism, and survival priority. Verdicts are reached by consensus across five LLM validators. Everything happens on-chain.

Live: https://genlayer-survivalmind.vercel.app/

---

## How It Works

1. **Generate a scenario** — A GenLayer intelligent contract calls an LLM to produce a unique survival scenario: environment, description, available resources, immediate threat, and difficulty level.

2. **Submit your plan** — Players write out their survival strategy in plain text, explaining step by step what they would do using the available resources to address the immediate threat.

3. **AI judgment** — A second intelligent contract reads the scenario and the submitted plan, then prompts an LLM to score the plan across three dimensions. `gl.eq_principle.non_comparative` lets each validator independently accept its own LLM output, since raw LLM text is never byte-identical across validators.

4. **Results on-chain** — Scores, verdicts, and feedback are stored permanently. A leaderboard tracks best scores across all players.

---

## Scoring Dimensions

| Dimension | Weight | Description |
|---|---|---|
| Survival Priority | 40% | Water, shelter, fire, food — correct order for the environment |
| Resourcefulness | 35% | Creative, effective use of available resources |
| Realism | 25% | Physical and logical feasibility |

**Verdicts:** Survivor / Likely Survivor / Unlikely Survivor / Did Not Survive

---

## Deployed Contracts

All contracts deployed on GenLayer Studionet.

| Contract | Address | Deploy TX |
|---|---|---|
| scenario.py | 0xBB92C508DbaFa1bC2AbfeEc0a462540f68e9f171 | https://explorer-studio.genlayer.com/tx/0xde7c88b686a10cb757b19fbbe6c595d6090021bfc5d14fde5510a3a073c36ef5 |
| submission.py | 0xa757Ce65c4F9c82B780C998479B7a079D98f66D4 | https://explorer-studio.genlayer.com/tx/0x6039f9604cbf0d60e41f241666cf73ad555339ec933921f892b24095867a49d9 |
| scoring.py | 0xa6d7E7fcB2CfE673ACb1757293392bea042985fA | https://explorer-studio.genlayer.com/tx/0x0510673dbbc8774194be01df6af2d9bd457dd0bfe02fc18bcc5310c6b9bbbc67 |

*(These are the current addresses after the compliance fix — pinned dependency hash, `non_comparative` equivalence principle. They match `frontend/.env.example`.)*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Intelligent Contracts | Python on GenLayer (GenVM) |
| Frontend | Next.js 16 + TypeScript |
| Wallet Integration | genlayer-js via npm |
| Hosting | Vercel |
| Network | GenLayer Studionet |

---

## Project Structure

```
/contracts
  scenario.py       Generates survival scenarios via LLM consensus
  submission.py     Stores player plan submissions on-chain
  scoring.py        Scores plans via LLM, maintains leaderboard

/frontend
  src/app/
    page.tsx        Main game UI
    layout.tsx      Root layout
    globals.css     Global styles
    page.module.css Component styles
  src/lib/
    genlayer.ts     genlayer-js client setup and helpers

/docs
  deployment.md     Full deployment guide
```

---

## Contract Functions

**scenario.py**
- `generate_scenario(round_id)` — LLM generates a unique scenario
- `get_scenario(round_id)` — Read scenario JSON
- `refresh(round_id)` — Regenerate scenario
- `close_round / flag_round / archive_round` — Round management

**submission.py**
- `submit_plan(round_id, player_address, plan)` — Store player plan
- `get_round_submissions(round_id)` — Read all submissions for a round
- `get_player_history(player_address)` — Player round history

**scoring.py**
- `score_plan(round_id, player_address, scenario_json, plan)` — LLM scores plan, updates leaderboard
- `get_score(round_id, player_address)` — Read latest score
- `get_leaderboard()` — All-time leaderboard
- `compare(round_id, player_a, player_b)` — Head-to-head comparison

---

## GenLayer Features Used

- `gl.nondet.exec_prompt` — LLM inference for scenario generation and plan scoring
- `gl.eq_principle.non_comparative` — Multi-validator consensus on nondeterministic LLM outputs (each validator independently accepts its own result rather than requiring byte-identical output)
- Multiple write functions per contract — analyze, refresh, compare, flag, archive
- Timestamped historical snapshots per round and player

---

## Running Locally

```bash
cd frontend
npm install
cp .env.example .env
# Fill in contract addresses in .env
npm run dev
```

Open http://localhost:3000

---

## License

MIT

