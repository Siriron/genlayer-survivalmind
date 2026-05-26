# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
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

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @gl.public.write
    def score_plan(self, round_id: str, player_address: str, scenario_json: str, plan: str) -> None:
        prompt = f"""You are an expert survival instructor and judge.

A player submitted a survival plan for this scenario:
{scenario_json}

PLAYER PLAN:
{plan}

Score each dimension from 0 to 100:
1. resourcefulness: creative use of available resources
2. realism: physically and logically feasible
3. priority: addresses immediate threat first, correct survival order

Also provide:
- overall_score: integer 0-100 (priority 40%, resourcefulness 35%, realism 25%)
- verdict: one of: survivor, likely_survivor, unlikely_survivor, did_not_survive
- feedback: 2 sentences of specific honest feedback

Return ONLY valid JSON with fields: resourcefulness, realism, priority, overall_score, verdict, feedback.
No markdown, no explanation."""

        def nondet():
            raw = gl.exec_prompt(prompt)
            fence = chr(96) * 3
            cleaned = raw.strip().replace(fence + "json", "").replace(fence, "").strip()
            return json.dumps(json.loads(cleaned))

        result_str = gl.eq_principle_strict_eq(nondet)
        result = json.loads(result_str)

        scores = self._get_scores()
        key = f"{round_id}:{player_address}"
        entry = {
            "round_id": round_id,
            "player": player_address,
            "scored_at": self._now(),
            "resourcefulness": result.get("resourcefulness", 0),
            "realism": result.get("realism", 0),
            "priority": result.get("priority", 0),
            "overall_score": result.get("overall_score", 0),
            "verdict": result.get("verdict", ""),
            "feedback": result.get("feedback", ""),
        }
        if key not in scores:
            scores[key] = []
        scores[key].append(entry)
        if len(scores[key]) > 10:
            scores[key] = scores[key][-10:]
        self._save_scores(scores)

        leaderboard = self._get_leaderboard()
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
            "scored_at": self._now(),
        })
        if len(lb["history"]) > 20:
            lb["history"] = lb["history"][-20:]
        leaderboard[player_address] = lb
        self._save_leaderboard(leaderboard)

    @gl.public.write
    def refresh(self, round_id: str, player_address: str, scenario_json: str, plan: str) -> None:
        self.score_plan(round_id, player_address, scenario_json, plan)

    @gl.public.write
    def compare(self, round_id: str, player_a: str, player_b: str) -> None:
        scores = self._get_scores()
        key_a = f"{round_id}:{player_a}"
        key_b = f"{round_id}:{player_b}"
        hist_a = scores.get(key_a, [])
        hist_b = scores.get(key_b, [])
        latest_a = hist_a[-1] if hist_a else {}
        latest_b = hist_b[-1] if hist_b else {}

        prompt = f"""Compare two survival plans based on scores.
Player A ({player_a}): {json.dumps(latest_a)}
Player B ({player_b}): {json.dumps(latest_b)}
Return ONLY valid JSON with: winner (address or "tie"), margin (int), reasoning (1 sentence)."""

        def nondet():
            raw = gl.exec_prompt(prompt)
            fence = chr(96) * 3
            cleaned = raw.strip().replace(fence + "json", "").replace(fence, "").strip()
            return json.dumps(json.loads(cleaned))

        gl.eq_principle_strict_eq(nondet)

    @gl.public.write
    def flag_score(self, round_id: str, player_address: str) -> None:
        scores = self._get_scores()
        key = f"{round_id}:{player_address}"
        if key in scores and scores[key]:
            scores[key][-1]["flagged"] = True
            scores[key][-1]["flagged_at"] = self._now()
            self._save_scores(scores)

    @gl.public.write
    def archive_round(self, round_id: str) -> None:
        scores = self._get_scores()
        for key in scores:
            if key.startswith(f"{round_id}:"):
                for entry in scores[key]:
                    entry["archived"] = True
        self._save_scores(scores)

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
