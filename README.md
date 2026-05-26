# SurvivalMind

**AI-judged survival strategy game on GenLayer.**

SurvivalMind drops players into dynamically generated survival scenarios — arctic tundra, jungle, desert, sinking ships — and asks a single question: what would you do? Players submit their survival plan in plain text. GenLayer's multi-validator AI network evaluates each plan across three dimensions: resourcefulness, realism, and survival priority. Verdicts are reached by consensus across five LLM validators. Everything happens on-chain.

---

## How It Works

1. **Generate a scenario** — A GenLayer intelligent contract calls an LLM to produce a unique survival scenario: environment, description, available resources, immediate threat, and difficulty level.

2. **Submit your plan** — Players write out their survival strategy in plain text, explaining step by step what they would do using the available resources to address the immediate threat.

3. **AI judgment** — A second intelligent contract reads the scenario and the submitted plan, then prompts an LLM to score the plan across three dimensions. `run_nondet_unsafe` ensures consensus across multiple validators before the result is accepted on-chain.

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

## Tech Stack

| Layer | Technology |
|---|---|
| Intelligent Contracts | Python on GenLayer (GenVM) |
| Frontend | Next.js 15 + TypeScript |
| Wallet Integration | genlayer-js v1.1.7 via npm |
| Hosting | Vercel |
| Network | GenLayer Testnet Bradbury |

---

## Project Structure

```
/contracts
  scenario.py       GenLayer contract — generates survival scenarios via LLM
  submission.py     GenLayer contract — stores player plan submissions
  scoring.py        GenLayer contract — scores plans, maintains leaderboard

/frontend
  src/app/
    page.tsx        Main game UI (connect wallet, generate, submit, results)
    layout.tsx      Root layout
    globals.css     Global styles
    page.module.css Component styles
  src/lib/
    genlayer.ts     genlayer-js client setup, read/write helpers

/docs
  deployment.md     Full deployment guide
```

---

## Contracts

All three contracts are deployed on GenLayer Testnet Bradbury (Studionet).

| Contract | Constructor Param | Purpose |
|---|---|---|
| `scenario.py` | `game_name: str` | Generates and stores survival scenarios per round |
| `submission.py` | `game_name: str` | Stores player plan submissions per round |
| `scoring.py` | `game_name: str` | Scores plans via LLM, maintains leaderboard |

### Key Functions

**scenario.py**
- `generate_scenario(round_id)` — LLM generates a unique scenario for the round
- `get_scenario(round_id)` — Read the scenario JSON
- `close_round(round_id)` — Mark round as closed
- `refresh(round_id)` — Regenerate the scenario

**submission.py**
- `submit_plan(round_id, player_address, plan)` — Store a player's survival plan
- `get_round_submissions(round_id)` — Read all submissions for a round
- `get_player_history(player_address)` — Read a player's round history

**scoring.py**
- `score_plan(round_id, player_address, scenario_json, plan)` — LLM scores a plan, updates leaderboard
- `get_score(round_id, player_address)` — Read the latest score for a player
- `get_leaderboard()` — Read all-time leaderboard data
- `compare(round_id, player_a, player_b)` — AI-judged head-to-head comparison

---

## GenLayer Features Used

- **`gl.nondet.exec_prompt`** — LLM inference for scenario generation and plan scoring
- **`run_nondet_unsafe` with `validator_fn`** — Multi-validator consensus for scored outputs
- **Multi-record TreeMap pattern** — Each contract tracks many entities (rounds, players) with timestamped history
- **Multiple write functions** — `analyze`, `refresh`, `compare`, `flag`, `archive` patterns throughout

---

## Running Locally

```bash
cd frontend
npm install
cp .env.example .env
# Fill in contract addresses in .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## License

MIT
