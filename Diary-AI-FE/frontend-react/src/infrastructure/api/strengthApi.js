import axios from 'axios';

const api = axios.create({ baseURL: '/api/strength' });

export const listMuscleGroups = async () => {
  const { data } = await api.get('/muscle-groups');
  return data;
};

export const searchExercises = async ({ query, muscleGroupId } = {}) => {
  const params = {};
  if (query) params.query = query;
  if (muscleGroupId) params.muscleGroupId = muscleGroupId;
  const { data } = await api.get('/exercises', { params });
  return data;
};

export const createWorkout = async (payload) => {
  const { data } = await api.post('/workouts', payload);
  return data;
};

export const listWorkouts = async ({ limit = 50, offset = 0 } = {}) => {
  const params = { limit, offset };
  const { data } = await api.get('/workouts', { params });
  return data;
};

export const getWorkout = async (id) => {
  const { data } = await api.get(`/workouts/${id}`);
  return data;
};

export const deleteWorkout = async (id) => {
  const { data } = await api.delete(`/workouts/${id}`);
  return data;
};

export const updateWorkout = async (id, payload) => {
  const { data } = await api.put(`/workouts/${id}`, payload);
  return data;
};

export const getSuggestion = async (exerciseId) => {
  const { data } = await api.get(`/exercises/${exerciseId}/suggestion`);
  return data;
};

export const exerciseContribution = async (muscleGroupId, { days = 30 } = {}) => {
  const params = { days };
  const { data } = await api.get(`/muscle-groups/${muscleGroupId}/exercise-contribution`, { params });
  return data;
};

export const weeklyFrequency = async (muscleGroupId, { weeks = 12 } = {}) => {
  const params = { weeks };
  const { data } = await api.get(`/muscle-groups/${muscleGroupId}/weekly-frequency`, { params });
  return data;
};

export const exerciseHistory = async (exerciseId, { limit = 20 } = {}) => {
  const params = { limit };
  const { data } = await api.get(`/exercises/${exerciseId}/history`, { params });
  return data;
};

// Analytics
export const exerciseE1RMSeries = async (exerciseId) => {
  const { data } = await api.get(`/analytics/exercises/${exerciseId}/e1rm`);
  return data;
};

export const workoutsOverview = async ({ days = 90 } = {}) => {
  const params = { days };
  const { data } = await api.get('/analytics/overview', { params });
  return data;
};

export const exerciseSummary = async (exerciseId, { days = 180 } = {}) => {
  const params = { days };
  const { data } = await api.get(`/analytics/exercises/${exerciseId}/summary`, { params });
  return data;
};

export const topProgress = async ({ days = 90, limit = 5 } = {}) => {
  const params = { days, limit };
  const { data } = await api.get('/analytics/top-progress', { params });
  return data;
};

export const strengthCorrelations = async ({ days = 90 } = {}) => {
  const params = { days };
  const { data } = await api.get('/analytics/correlations', { params });
  return data;
};

// Templates
export const listTemplates = async () => {
  const { data } = await api.get('/templates');
  return data;
};
export const upsertTemplate = async (tpl) => {
  const { data } = await api.post('/templates', tpl);
  return data;
};
export const deleteTemplate = async (id) => {
  const { data } = await api.delete(`/templates/${id}`);
  return data;
};

// no default export to satisfy lint preferences
