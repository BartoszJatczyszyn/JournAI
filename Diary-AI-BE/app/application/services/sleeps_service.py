from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from datetime import date, datetime
from domain.repositories.sleeps import ISleepsRepository

class SleepsService:
	def __init__(self, repo: ISleepsRepository) -> None:
		self.repo = repo

	def _phase_label(self, value: Any) -> Optional[str]:
		"""Map last_sleep_phase (string or numeric) to a normalized label.
		Accepted strings (case-insensitive, substring match): deep, light, rem, awake/wake.
		Accepted numeric codes: 1=Deep, 2=Light, 3=REM, 4=Awake.
		"""
		if value is None:
			return None
		try:
			# numeric mapping
			n = int(value)
			if n == 1:
				return 'Deep'
			if n == 2:
				return 'Light'
			if n == 3:
				return 'REM'
			if n == 4:
				return 'Awake'
		except Exception:
			pass
		# string mapping
		s = str(value).strip().lower()
		if not s:
			return None
		if 'deep' in s:
			return 'Deep'
		if 'rem' in s:
			return 'REM'
		if 'light' in s:
			return 'Light'
		if 'awake' in s or 'wake' in s:
			return 'Awake'
		return None

	def _normalize_row(self, item: Dict[str, Any]) -> Dict[str, Any]:
		for k in ['day','sleep_start','sleep_end']:
			if item.get(k) and hasattr(item[k], 'isoformat'):
				item[k] = item[k].isoformat()
		if item.get('sleep_duration_seconds') is not None:
			item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
		return item

	async def latest(self, limit: int, offset: int, start_date: Optional[str], end_date: Optional[str]) -> Dict[str, Any]:
		conditions = ["sleep_start IS NOT NULL"]
		params: List[Any] = []
		if start_date:
			conditions.append("sleep_start >= %s")
			params.append(start_date)
		if end_date:
			conditions.append("sleep_start <= %s")
			params.append(end_date)
		where_clause = " AND ".join(conditions)
		total = await self.repo.count_in_range(where_clause, tuple(params))
		rows = await self.repo.fetch_latest(where_clause, tuple(params), limit, offset)
		# Fetch sleep events for each unique day returned so the frontend can compute
		# 'last_pre_wake_phase' from the embedded events. Perform in parallel.
		items: List[Dict[str, Any]] = []
		try:
			# Collect unique day strings for querying events
			days = []
			for r in rows:
				rday = r.get('day')
				if rday is None:
					continue
				if hasattr(rday, 'isoformat'):
					days.append(rday.isoformat())
				else:
					days.append(str(rday))
			unique_days = list(dict.fromkeys(days))
			# schedule fetches
			import asyncio
			tasks = {d: asyncio.create_task(self.repo.fetch_events_for_day(d)) for d in unique_days}
			if tasks:
				results = await asyncio.gather(*tasks.values(), return_exceptions=True)
				# map day -> events (ignore failures)
				events_map = {}
				for day, res in zip(tasks.keys(), results):
					if isinstance(res, Exception):
						events_map[day] = []
					else:
						events_map[day] = res or []
			else:
				events_map = {}
		except Exception:
			# Non-fatal: if events fetching fails, continue without events
			events_map = {}

		for r in rows:
			item = dict(r)
			# attach events under the preferred frontend key
			rday = r.get('day')
			day_key = None
			if rday is not None:
				if hasattr(rday, 'isoformat'):
					day_key = rday.isoformat()
				else:
					day_key = str(rday)
			if day_key:
				raw_events = events_map.get(day_key, [])
			else:
				raw_events = []
			# Normalize events: ensure timestamp as ISO, provide aliases `ts`, and `stage` key
			normalized = []
			for ev in raw_events:
				if not isinstance(ev, dict):
					continue
				nev = dict(ev)
				# timestamp -> ISO
				ts = nev.get('timestamp') or nev.get('ts') or nev.get('t')
				if hasattr(ts, 'isoformat'):
					try:
						nev['timestamp'] = ts.isoformat()
					except Exception:
						nev['timestamp'] = str(ts)
				elif ts is not None:
					nev['timestamp'] = str(ts)
				# set ts alias if missing
				if 'ts' not in nev and 'timestamp' in nev:
					nev['ts'] = nev['timestamp']
				# ensure event/stage naming
				if 'event' in nev and 'stage' not in nev:
					nev['stage'] = nev.get('event')
				if 'stage' in nev and 'event' not in nev:
					nev['event'] = nev.get('stage')
				normalized.append(nev)
			item['garmin_sleep_events'] = normalized
			# Backfill common keys so frontend finds events under multiple names
			if not item.get('sleep_events'):
				item['sleep_events'] = list(normalized)
			if not item.get('events'):
				item['events'] = list(normalized)
			for k in ['day','sleep_start','sleep_end']:
				if item.get(k) and hasattr(item[k], 'isoformat'):
					item[k] = item[k].isoformat()
			if item.get('sleep_duration_seconds') is not None:
				item['duration_min'] = round((item['sleep_duration_seconds'] or 0) / 60.0)
			# Derive label for Last Phase Before Wake from persisted session column
			lsp = item.get('last_sleep_phase')
			label = self._phase_label(lsp)
			if label:
				item['last_sleep_phase_label'] = label
			items.append(item)
		return { 'total_count': total, 'sleeps': items }

	async def events_for_day(self, day: str) -> List[Dict[str, Any]]:
		rows = await self.repo.fetch_events_for_day(day)
		for item in rows:
			if item.get('ts') and hasattr(item['ts'], 'isoformat'):
				item['ts'] = item['ts'].isoformat()
			dur = item.get('duration')
			if dur is not None and not isinstance(dur, str):
				try:
					item['duration'] = str(dur)
				except Exception:
					pass
		return rows

	async def detail(self, sleep_id: int) -> Dict[str, Any]:
		row = await self.repo.get_by_id(sleep_id)
		if not row:
			raise LookupError('not found')
		item = self._normalize_row(dict(row))
		# Enrich with events for day
		day = item.get('day')
		if day:
			try:
				day_s = day if isinstance(day, str) else getattr(day, 'isoformat', lambda: str(day))()
				evs = await self.repo.fetch_events_for_day(day_s)
				# Normalize events shape and keys
				nevs = []
				for e in evs:
					if not isinstance(e, dict):
						continue
					d = dict(e)
					ts = d.get('timestamp') or d.get('ts') or d.get('t')
					if hasattr(ts, 'isoformat'):
						try:
							d['timestamp'] = ts.isoformat()
						except Exception:
							d['timestamp'] = str(ts)
					elif ts is not None:
						d['timestamp'] = str(ts)
					if 'ts' not in d and 'timestamp' in d:
						d['ts'] = d['timestamp']
					if 'event' in d and 'stage' not in d:
						d['stage'] = d.get('event')
					if 'stage' in d and 'event' not in d:
						d['event'] = d.get('stage')
					nevs.append(d)
				item['garmin_sleep_events'] = nevs
				if not item.get('sleep_events'):
					item['sleep_events'] = list(nevs)
				if not item.get('events'):
					item['events'] = list(nevs)
			except Exception:
				pass
		# Backfill percentages
		total = max((item.get('sleep_duration_seconds') or 0), 1)
		for k in ['deep_sleep_seconds','light_sleep_seconds','rem_sleep_seconds','awake_seconds']:
			if item.get(k) is not None:
				item[k.replace('_seconds','_pct')] = round((item[k] / total) * 100.0, 1)
		# Derive last phase label
		label = self._phase_label(item.get('last_sleep_phase'))
		if label:
			item['last_sleep_phase_label'] = label
		# Pre-populate series placeholders
		item.setdefault('hr_series', [])
		item.setdefault('stress_series', [])
		item.setdefault('rr_series', [])
		return item

	async def create_sleep(self, payload: Dict[str, Any]) -> Dict[str, Any]:
		from datetime import date as _date
		day_val = payload.get('day')
		if not day_val and payload.get('sleep_start'):
			day_val = payload['sleep_start'].date()
		if not day_val and payload.get('sleep_end'):
			day_val = payload['sleep_end'].date()
		if not day_val:
			day_val = _date.today()
		sc = payload.get('sleep_score')
		if sc is not None:
			iv = int(sc)
			if iv < 0 or iv > 100:
				raise ValueError('sleep_score out of range')
		derived = payload.get('sleep_duration_seconds')
		if derived is None and payload.get('sleep_start') and payload.get('sleep_end'):
			delta = (payload['sleep_end'] - payload['sleep_start']).total_seconds()
			if delta <= 0:
				delta += 24 * 60 * 60
			derived = int(max(0, round(delta)))
		present = await self.repo.columns_present()
		if 'day' not in present:
			raise RuntimeError("garmin_sleep_sessions.table missing 'day' column")
		cols: list[str] = ['day']
		params: list[Any] = [day_val]
		def add(col: str, val: Any):
			cols.append(col)
			params.append(val)
		for col in (
			'sleep_start','sleep_end','sleep_duration_seconds','deep_sleep_seconds','light_sleep_seconds',
			'rem_sleep_seconds','awake_seconds','sleep_score','avg_sleep_hr','avg_sleep_rr','avg_sleep_stress'
		):
			v = payload.get(col)
			if col == 'sleep_duration_seconds' and derived is not None:
				v = derived
			if v is not None and col in present:
				add(col, v)
		row = await self.repo.insert_returning(cols, tuple(params))
		if not row:
			raise RuntimeError('Insert failed')
		return self._normalize_row(dict(row))

	async def update_sleep(self, sleep_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
		sc = payload.get('sleep_score')
		if sc is not None:
			iv = int(sc)
			if iv < 0 or iv > 100:
				raise ValueError('sleep_score out of range')
		derived = payload.get('sleep_duration_seconds')
		if derived is None and payload.get('sleep_start') and payload.get('sleep_end'):
			delta = (payload['sleep_end'] - payload['sleep_start']).total_seconds()
			if delta <= 0:
				delta += 24 * 60 * 60
			derived = int(max(0, round(delta)))
		present = await self.repo.columns_present()
		updates: list[tuple[str, Any]] = []
		def upd(col: str, val: Any):
			updates.append((col, val))
		for col in (
			'day','sleep_start','sleep_end','sleep_duration_seconds','deep_sleep_seconds','light_sleep_seconds',
			'rem_sleep_seconds','awake_seconds','sleep_score','avg_sleep_hr','avg_sleep_rr','avg_sleep_stress'
		):
			v = payload.get(col)
			if col == 'sleep_duration_seconds' and derived is not None:
				v = derived
			if v is not None and col in present:
				upd(col, v)
		if not updates:
			row = await self.repo.get_by_id(sleep_id)
			if not row:
				raise LookupError('not found')
			return self._normalize_row(dict(row))
		row = await self.repo.update_returning(sleep_id, updates)
		if not row:
			raise LookupError('not found or update failed')
		return self._normalize_row(dict(row))

	async def delete_sleep(self, sleep_id: int) -> bool:
		if not await self.repo.exists(sleep_id):
			return False
		await self.repo.delete(sleep_id)
		return True

__all__ = ["SleepsService"]
