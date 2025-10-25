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

export const listWorkouts = async ({ limit = 50, offset = 0, userId } = {}) => {
  const params = { limit, offset };
  if (userId) params.userId = userId;
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

export const getSuggestion = async (exerciseId, userId) => {
  const { data } = await api.get(`/exercises/${exerciseId}/suggestion`, { params: { userId } });
  return data;
};

export const exerciseContribution = async (muscleGroupId, { days = 30, userId } = {}) => {
  const params = { days };
  if (userId) params.userId = userId;
  const { data } = await api.get(`/muscle-groups/${muscleGroupId}/exercise-contribution`, { params });
  return data;
};

export const weeklyFrequency = async (muscleGroupId, { weeks = 12, userId } = {}) => {
  const params = { weeks };
  if (userId) params.userId = userId;
  const { data } = await api.get(`/muscle-groups/${muscleGroupId}/weekly-frequency`, { params });
  return data;
};

export const exerciseHistory = async (exerciseId, { limit = 20, userId } = {}) => {
  const params = { limit };
  if (userId) params.userId = userId;
  const { data } = await api.get(`/exercises/${exerciseId}/history`, { params });
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
