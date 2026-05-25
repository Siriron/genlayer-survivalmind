# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from datetime import datetime, timezone


class SurvivalScenario(gl.Contract):
    game_name: str
    scenarios: str
    round_counter: str

    def __init__(self, game_name: str):
        self.game_name = game_name
        self.scenarios = "{}"
        self.round_counter = "0"

    def _get_scenarios(self) -> dict:
        return json.loads(self.scenarios)

    def _save_scenarios(self, data: dict):
        self.scenarios = json.dumps(data)

    def _now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @gl.public.write
    def generate_scenario(self, round_id: str) -> typing.Any:
        scenarios = self._get_scenarios()

        def leader_fn():
            prompt = """You are a survival game scenario generator.

Generate a unique, vivid survival scenario for a game round. The scenario should place the player in immediate danger and describe:
- The environment (e.g. Sahara desert, Arctic tundra, sinking ship, dense jungle, volcanic island)
- The situation (what just happened, why they are in danger)
- Available resources nearby (be specific, list 4 to 6 items they can see around them)
- The immediate threat they must address (dehydration, cold, predator, storm, etc.)

Return ONLY a JSON object with these fields:
- environment: string (short name, e.g. "Arctic Tundra")
- description: string (3 sentences setting the scene)
- available_resources: list of strings (4 to 6 specific items)
- immediate_threat: string (the single most pressing danger)
- difficulty: string (one of: "easy", "medium", "hard", "extreme")

No explanation, no markdown, only valid JSON."""
            raw = gl.nondet.exec_prompt(prompt)
            fence = chr(96) * 3
            cleaned = raw.strip().replace(fence + "json", "").replace(fence, "").strip()
            return json.loads(cleaned)

        def validator_fn(leader_result):
            if not isinstance(leader_result, gl.vm.Return):
                return False
            val = leader_result.result
            if not isinstance(val, dict):
                return False
            required = ["environment", "description", "available_resources", "immediate_threat", "difficulty"]
            return all(k in val for k in required)

        result = gl.run_nondet_unsafe(leader_fn, validator_fn)

        entry = {
            "round_id": round_id,
            "generated_at": SurvivalScenario._now(),
            "environment": result.get("environment"),
            "description": result.get("description"),
            "available_resources": result.get("available_resources"),
            "immediate_threat": result.get("immediate_threat"),
            "difficulty": result.get("difficulty"),
            "status": "open",
        }
        scenarios[round_id] = entry
        self._save_scenarios(scenarios)

        counter = int(self.round_counter) + 1
        self.round_counter = str(counter)

        return json.dumps(entry)

    @gl.public.write
    def refresh(self, round_id: str) -> typing.Any:
        return self.generate_scenario(round_id)

    @gl.public.write
    def close_round(self, round_id: str) -> typing.Any:
        scenarios = self._get_scenarios()
        if round_id not in scenarios:
            return f"Round {round_id} not found"
        scenarios[round_id]["status"] = "closed"
        scenarios[round_id]["closed_at"] = SurvivalScenario._now()
        self._save_scenarios(scenarios)
        return f"Round {round_id} closed"

    @gl.public.write
    def flag_round(self, round_id: str) -> typing.Any:
        scenarios = self._get_scenarios()
        if round_id not in scenarios:
            return f"Round {round_id} not found"
        scenarios[round_id]["flagged"] = True
        scenarios[round_id]["flagged_at"] = SurvivalScenario._now()
        self._save_scenarios(scenarios)
        return f"Round {round_id} flagged"

    @gl.public.write
    def archive_round(self, round_id: str) -> typing.Any:
        scenarios = self._get_scenarios()
        if round_id not in scenarios:
            return f"Round {round_id} not found"
        scenarios[round_id]["archived"] = True
        scenarios[round_id]["archived_at"] = SurvivalScenario._now()
        self._save_scenarios(scenarios)
        return f"Round {round_id} archived"

    @gl.public.view
    def get_scenario(self, round_id: str) -> str:
        scenarios = self._get_scenarios()
        return json.dumps(scenarios.get(round_id, {}))

    @gl.public.view
    def get_all_scenarios(self) -> str:
        return self.scenarios

    @gl.public.view
    def get_round_count(self) -> str:
        return self.round_counter
