# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from datetime import datetime, timezone


class SurvivalScoring(gl.Contract):
    game_name: str
    scores: str
    leaderboard: str

    def __init__(self, game_name: str):
        self.game_name = game_name
        self.scores = "{}"
        self.leaderboard = "{}"

    def _get_scores(self) -> dict:
        return json.loads(self.scores)

    def _get_leaderboard(self) -> dict:
        return json.loads(self.leaderboard)

    def _save_scores(self, data: dict):
        self.scores = json.dumps(data)

    def _save_leaderboard(self, data: dict):
        self.leaderboard = json.dumps(data)

    def _now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @gl.public.write
    def score_plan(self, round_id: str, player_address: str, scenario_json: str, plan: str) -> typing.Any:
        scores = self._get_scores()
        leaderboard = self._get_leaderboard()

        def leader_fn():
            prompt = f"""You are an expert survival instructor and judge.

A player has submitted a survival plan for the following scenario:

SCENARIO:
{scenario_json}

PLAYER PLAN:
{plan}

Evaluate the plan strictly on survival merit. Score each dimension from 0 to 100:

1. resourcefulness: How well does the player use the listed available resources? Do they improvise creatively?
2. realism: Is the plan physically and logically feasible? Could a real person actually do this?
3. priority: Do they address the immediate threat first? Is water, shelter, fire, and food handled in the right order for this environment?

Also provide:
- overall_score: integer 0-100 (weighted average: priority 40%, resourcefulness 35%, realism 25%)
- verdict: string (one of: "survivor", "likely_survivor", "unlikely_survivor", "did_not_survive")
- feedback: string (2 sentences of specific, honest feedback referencing their actual plan)

Return ONLY valid JSON with these fields: resourcefulness, realism, priority, overall_score, verdict, feedback.
No explanation, no markdown."""

            raw = gl.nondet.exec_prompt(prompt)
            fence = chr(96) * 3
            cleaned = raw.strip().replace(fence + "json", "").replace(fence, "").strip()
            return json.loads(cleaned)


            if not all(k in val for k in required):
                return False
            score = val.get("overall_score", -1)
            return isinstance(score, int) and 0 <= score <= 100

        result = gl.run_nondet_unsafe(leader_fn, validator_fn)

        key = f"{round_id}:{player_address}"
        entry = {
            "round_id": round_id,
            "player": player_address,
            "scored_at": SurvivalScoring._now(),
            "resourcefulness": result.get("resourcefulness"),
            "realism": result.get("realism"),
            "priority": result.get("priority"),
            "overall_score": result.get("overall_score"),
            "verdict": result.get("verdict"),
            "feedback": result.get("feedback"),
        }

        if key not in scores:
            scores[key] = []
        scores[key].append(entry)
        if len(scores[key]) > 10:
            scores[key] = scores[key][-10:]
        self._save_scores(scores)

        if player_address not in leaderboard:
            leaderboard[player_address] = {
                "player": player_address,
                "total_rounds": 0,
                "total_score": 0,
                "best_score": 0,
                "survivor_count": 0,
                "history": [],
            }

        lb = leaderboard[player_address]
        lb["total_rounds"] = lb.get("total_rounds", 0) + 1
        lb["total_score"] = lb.get("total_score", 0) + result.get("overall_score", 0)
        lb["best_score"] = max(lb.get("best_score", 0), result.get("overall_score", 0))
        if result.get("verdict") in ("survivor", "likely_survivor"):
            lb["survivor_count"] = lb.get("survivor_count", 0) + 1
        lb["history"].append({
            "round_id": round_id,
            "score": result.get("overall_score"),
            "verdict": result.get("verdict"),
            "scored_at": SurvivalScoring._now(),
        })
        if len(lb["history"]) > 20:
            lb["history"] = lb["history"][-20:]
        leaderboard[player_address] = lb
        self._save_leaderboard(leaderboard)

        return json.dumps(entry)

    @gl.public.write
    def refresh(self, round_id: str, player_address: str, scenario_json: str, plan: str) -> typing.Any:
        return self.score_plan(round_id, player_address, scenario_json, plan)

    @gl.public.write
    def compare(self, round_id: str, player_a: str, player_b: str) -> typing.Any:
        scores = self._get_scores()

        key_a = f"{round_id}:{player_a}"
        key_b = f"{round_id}:{player_b}"

        hist_a = scores.get(key_a, [])
        hist_b = scores.get(key_b, [])

        latest_a = hist_a[-1] if hist_a else {}
        latest_b = hist_b[-1] if hist_b else {}

        def leader_fn():
            prompt = f"""Compare two survival plans based on their scores.

Player A ({player_a}):
{json.dumps(latest_a)}

Player B ({player_b}):
{json.dumps(latest_b)}

Return ONLY valid JSON with:
- winner: string (player address of winner or "tie")
- margin: integer (difference in overall_score, 0 if tie)
- reasoning: string (1 sentence explaining the result)"""

            raw = gl.nondet.exec_prompt(prompt)
            fence = chr(96) * 3
            cleaned = raw.strip().replace(fence + "json", "").replace(fence, "").strip()
            return json.loads(cleaned)

        def validator_fn(leader_result):
            if not isinstance(leader_result, gl.vm.Return):
                return False
            val = leader_result.result
            return isinstance(val, dict) and "winner" in val

        result = gl.run_nondet_unsafe(leader_fn, validator_fn)
        return json.dumps(result)

    @gl.public.write
    def flag_score(self, round_id: str, player_address: str) -> typing.Any:
        scores = self._get_scores()
        key = f"{round_id}:{player_address}"
        if key not in scores or not scores[key]:
            return "Score not found"
        scores[key][-1]["flagged"] = True
        scores[key][-1]["flagged_at"] = SurvivalScoring._now()
        self._save_scores(scores)
        return f"Flagged score for {player_address} in round {round_id}"

    @gl.public.write
    def archive_round(self, round_id: str) -> typing.Any:
        scores = self._get_scores()
        archived = 0
        for key in scores:
            if key.startswith(f"{round_id}:"):
                for entry in scores[key]:
                    entry["archived"] = True
                archived += 1
        self._save_scores(scores)
        return f"Archived scores for round {round_id} ({archived} players)"

    @gl.public.view
    def get_score(self, round_id: str, player_address: str) -> str:
        scores = self._get_scores()
        key = f"{round_id}:{player_address}"
        history = scores.get(key, [])
        if not history:
            return "{}"
        return json.dumps(history[-1])

    @gl.public.view
    def get_score_history(self, round_id: str, player_address: str) -> str:
        scores = self._get_scores()
        key = f"{round_id}:{player_address}"
        return json.dumps(scores.get(key, []))

    @gl.public.view
    def get_leaderboard(self) -> str:
        return self.leaderboard

    @gl.public.view
    def get_player_stats(self, player_address: str) -> str:
        leaderboard = self._get_leaderboard()
        return json.dumps(leaderboard.get(player_address, {}))
