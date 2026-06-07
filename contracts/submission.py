# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from datetime import datetime, timezone


class SurvivalSubmission(gl.Contract):
    game_name: str
    submissions: str
    player_history: str

    def __init__(self, game_name: str):
        self.game_name = game_name
        self.submissions = "{}"
        self.player_history = "{}"

    def _get_submissions(self) -> dict:
        return json.loads(self.submissions)

    def _get_player_history(self) -> dict:
        return json.loads(self.player_history)

    def _save_submissions(self, data: dict):
        self.submissions = json.dumps(data)

    def _save_player_history(self, data: dict):
        self.player_history = json.dumps(data)

    # FIX: was missing `self` parameter — caused a TypeError at runtime
    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @gl.public.write
    def submit_plan(self, round_id: str, player_address: str, plan: str) -> typing.Any:
        submissions = self._get_submissions()
        history = self._get_player_history()

        if round_id not in submissions:
            submissions[round_id] = {}

        entry = {
            "player": player_address,
            "plan": plan,
            "submitted_at": self._now(),
            "scored": False,
            "score": None,
        }
        submissions[round_id][player_address] = entry
        self._save_submissions(submissions)

        if player_address not in history:
            history[player_address] = []
        history[player_address].append({
            "round_id": round_id,
            "submitted_at": self._now(),
        })
        if len(history[player_address]) > 50:
            history[player_address] = history[player_address][-50:]
        self._save_player_history(history)

        return f"Plan submitted for round {round_id}"

    @gl.public.write
    def refresh(self, round_id: str, player_address: str) -> typing.Any:
        submissions = self._get_submissions()
        round_subs = submissions.get(round_id, {})
        sub = round_subs.get(player_address, {})
        if not sub:
            return f"No submission found for {player_address} in round {round_id}"
        sub["refreshed_at"] = self._now()
        submissions[round_id][player_address] = sub
        self._save_submissions(submissions)
        return f"Submission refreshed for {player_address} in round {round_id}"

    @gl.public.write
    def mark_scored(self, round_id: str, player_address: str, score: str) -> typing.Any:
        submissions = self._get_submissions()
        if round_id not in submissions:
            return f"Round {round_id} not found"
        if player_address not in submissions[round_id]:
            return f"Player {player_address} not found in round {round_id}"
        submissions[round_id][player_address]["scored"] = True
        submissions[round_id][player_address]["score"] = score
        submissions[round_id][player_address]["scored_at"] = self._now()
        self._save_submissions(submissions)
        return f"Marked scored for {player_address} in round {round_id}"

    @gl.public.write
    def flag_submission(self, round_id: str, player_address: str) -> typing.Any:
        submissions = self._get_submissions()
        if round_id not in submissions or player_address not in submissions[round_id]:
            return "Submission not found"
        submissions[round_id][player_address]["flagged"] = True
        submissions[round_id][player_address]["flagged_at"] = self._now()
        self._save_submissions(submissions)
        return f"Flagged submission from {player_address} in round {round_id}"

    @gl.public.write
    def archive_round(self, round_id: str) -> typing.Any:
        submissions = self._get_submissions()
        if round_id not in submissions:
            return f"Round {round_id} not found"
        for addr in submissions[round_id]:
            submissions[round_id][addr]["archived"] = True
        self._save_submissions(submissions)
        return f"Archived all submissions for round {round_id}"

    @gl.public.view
    def get_submission(self, round_id: str, player_address: str) -> str:
        submissions = self._get_submissions()
        round_subs = submissions.get(round_id, {})
        return json.dumps(round_subs.get(player_address, {}))

    @gl.public.view
    def get_round_submissions(self, round_id: str) -> str:
        submissions = self._get_submissions()
        return json.dumps(submissions.get(round_id, {}))

    @gl.public.view
    def get_player_history(self, player_address: str) -> str:
        history = self._get_player_history()
        return json.dumps(history.get(player_address, []))

    @gl.public.view
    def get_all_submissions(self) -> str:
        return self.submissions
