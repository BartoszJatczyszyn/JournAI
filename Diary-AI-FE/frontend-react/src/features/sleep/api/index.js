// Feature-level API facade for Sleep feature
// Wrap infrastructure API and map DTOs to domain models
import infraSleeps from 'infrastructure/api/sleeps';
import { mapSleepSummaryDtoToModel, mapSleepItemDtoToModel, mapTimeseriesDtoToModel } from 'entities/sleep/model';

export async function getLatestSleeps(params) {
  const res = await infraSleeps.getLatestSleeps(params);
  if (!res) return { sleeps: [], total_count: 0 };
  if (Array.isArray(res)) return { sleeps: res.map(mapSleepItemDtoToModel), total_count: res.length };
  const sleeps = Array.isArray(res.sleeps) ? res.sleeps.map(mapSleepItemDtoToModel) : [];
  const total = res.total_count ?? res.count ?? sleeps.length;
  return { sleeps, total_count: total };
}

export async function getSleepById(id) {
  const dto = await infraSleeps.getSleepById(id);
  // infra may return { sleep: { ... } } or the raw object directly. Normalize.
  const raw = dto?.sleep ?? dto;
  return mapSleepItemDtoToModel(raw);
}

export async function getSleepEvents(date) {
  // Pass-through to infrastructure; normalize common response shapes to an array
  try {
    const res = await infraSleeps.getSleepEvents(date);
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.events)) return res.events;
    if (Array.isArray(res.rows)) return res.rows;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.items)) return res.items;
    return res;
  } catch (e) {
    console.warn('getSleepEvents failed:', e);
    return [];
  }
}

export async function getSleepTimeseries(params) {
  const list = await infraSleeps.getLatestSleeps(params);
  const items = Array.isArray(list?.sleeps) ? list.sleeps : (Array.isArray(list) ? list : []);
  return mapTimeseriesDtoToModel(items);
}

export async function getSleepSummary(params) {
  const dto = await infraSleeps.getLatestSleeps(params);
  // Best-effort: some endpoints may return summary fields mixed in
  const base = Array.isArray(dto?.sleeps) && dto.sleeps.length ? dto.summary || null : dto?.summary || dto || null;
  return mapSleepSummaryDtoToModel(base);
}

export async function analyzeSleepCorrelations(...args) {
  // pass-through for now if implemented in backend
  return typeof infraSleeps.analyzeSleepCorrelations === 'function'
    ? infraSleeps.analyzeSleepCorrelations(...args)
    : null;
}

export const sleepsAPI = {
  getLatestSleeps,
  getSleepById,
  getSleepEvents,
  getSleepTimeseries,
  getSleepSummary,
  analyzeSleepCorrelations,
};
