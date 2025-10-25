from __future__ import annotations
from typing import Optional
from domain.repositories.gym import IGymRepository

TEMPLATES_KEY = 'templates'
SESSIONS_KEY = 'sessions'
MANUAL1RM_KEY = 'manual_1rm'

class GymService:
	def __init__(self, repo: IGymRepository) -> None:
		self.repo = repo

	def list_templates(self) -> list:
		return self.repo.load_bucket(TEMPLATES_KEY)

	def upsert_template(self, tpl: dict) -> dict:
		data = self.repo.load_bucket(TEMPLATES_KEY)
		data = [d for d in data if d.get('id') != tpl.get('id')]
		data.append(tpl)
		self.repo.save_bucket(TEMPLATES_KEY, data)
		return tpl

	def delete_template(self, tpl_id: str) -> bool:
		data = self.repo.load_bucket(TEMPLATES_KEY)
		new_data = [d for d in data if d.get('id') != tpl_id]
		if len(new_data) == len(data):
			return False
		self.repo.save_bucket(TEMPLATES_KEY, new_data)
		return True

	def list_sessions(self) -> list:
		return self.repo.load_bucket(SESSIONS_KEY)

	def upsert_session(self, session: dict) -> dict:
		data = self.repo.load_bucket(SESSIONS_KEY)
		data = [d for d in data if d.get('id') != session.get('id')]
		data.append(session)
		self.repo.save_bucket(SESSIONS_KEY, data)
		return session

	def delete_session(self, session_id: str) -> bool:
		data = self.repo.load_bucket(SESSIONS_KEY)
		new_data = [d for d in data if d.get('id') != session_id]
		if len(new_data) == len(data):
			return False
		self.repo.save_bucket(SESSIONS_KEY, new_data)
		return True

	def list_manual_1rm(self) -> list:
		return self.repo.load_bucket(MANUAL1RM_KEY)

	def upsert_manual_1rm(self, entry: dict) -> dict:
		data = self.repo.load_bucket(MANUAL1RM_KEY)
		data = [d for d in data if d.get('id') != entry.get('id')]
		data.append(entry)
		self.repo.save_bucket(MANUAL1RM_KEY, data)
		return entry

	def delete_manual_1rm(self, entry_id: str) -> bool:
		data = self.repo.load_bucket(MANUAL1RM_KEY)
		new_data = [d for d in data if d.get('id') != entry_id]
		if len(new_data) == len(data):
			return False
		self.repo.save_bucket(MANUAL1RM_KEY, new_data)
		return True

__all__ = ["GymService"]
