# { "Depends": "py-genlayer:latest" }

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

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @gl.public.write
    def generate_scenario(self, round_id: str) -> typing.Any:
        prompt = """You are a survival game scenario generator.

Generate a unique vivid survival scenario. Return ONLY a JSON object with these exact fields:
- environment: string (short name, e.g. "Arctic Tundra")
- description: string (2-3 sentences setting the scene)
- available_resources: list of 4-6 specific item strings
- immediate_threat: string (the single most pressing danger)
- difficulty: string (one of: easy, medium, hard, extreme)

No explanation, no markdown, only valid JSON."""

        def non_det():
            try:
                raw = gl.nondet.exec_prompt(prompt)
                fence = chr(96) * 3
                cleaned = raw.strip().replace(fence + "json", "").replace(fence, "").strip()
                return json.dumps(json.loads(cleaned))
            except Exception as e:
                return json.dumps({"error": str(e)})

        result_str = gl.eq_principle.strict_eq(non_det)
        result = json.loads(result_str)

        scenarios = self._get_scenarios()
        entry = {
            "round_id": round_id,
            "generated_at": self._now(),
            "environment": result.get("environment", ""),
            "description": result.get("description", ""),
            "available_resources": result.get("available_resources", []),
            "immediate_threat": result.get("immediate_threat", ""),
            "difficulty": result.get("difficulty", "medium"),
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
        if round_id in scenarios:
            scenarios[round_id]["status"] = "closed"
            scenarios[round_id]["closed_at"] = self._now()
            self._save_scenarios(scenarios)
        return f"Round {round_id} closed"

    @gl.public.write
    def flag_round(self, round_id: str) -> typing.Any:
        scenarios = self._get_scenarios()
        if round_id in scenarios:
            scenarios[round_id]["flagged"] = True
            scenarios[round_id]["flagged_at"] = self._now()
            self._save_scenarios(scenarios)
        return f"Round {round_id} flagged"

    @gl.public.write
    def archive_round(self, round_id: str) -> typing.Any:
        scenarios = self._get_scenarios()
        if round_id in scenarios:
            scenarios[round_id]["archived"] = True
            scenarios[round_id]["archived_at"] = self._now()
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
