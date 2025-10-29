// Strength feature API facade
import * as infra from 'infrastructure/api/strengthApi';
import { mapWorkoutDtoToModel, mapWorkoutsDtoToModel, mapTemplateDtoToModel } from 'entities/strength/model';

export const strengthAPI = {
  async workoutsOverview(params){ const res = await infra.workoutsOverview(params); return res; },
  async topProgress(params){ const res = await infra.topProgress(params); return res; },
  async strengthCorrelations(params){ const res = await infra.strengthCorrelations(params); return res; },

  async listWorkouts(params){ const res = await infra.listWorkouts(params); return mapWorkoutsDtoToModel(res?.workouts || res || []); },
  async getWorkout(id){ const res = await infra.getWorkout(id); return mapWorkoutDtoToModel(res); },
  async deleteWorkout(id){ return infra.deleteWorkout(id); },
  async updateWorkout(id, payload){ const res = await infra.updateWorkout(id, payload); return mapWorkoutDtoToModel(res); },

  async listTemplates(){ const res = await infra.listTemplates(); return (res?.templates || res || []).map(mapTemplateDtoToModel); },
  async upsertTemplate(payload){ const res = await infra.upsertTemplate(payload); return mapTemplateDtoToModel(res); },
  async deleteTemplate(id){ return infra.deleteTemplate(id); },

  async listMuscleGroups(){ return infra.listMuscleGroups(); },
  async searchExercises(q){ return infra.searchExercises(q); },
  async createWorkout(payload){ const res = await infra.createWorkout(payload); return mapWorkoutDtoToModel(res); },
  async getSuggestion(payload){ return infra.getSuggestion(payload); },
  async exerciseE1RMSeries(id){ return infra.exerciseE1RMSeries(id); },
};

export default strengthAPI;

// Named exports for convenience (some modules import named functions)
export const workoutsOverview = (...args) => strengthAPI.workoutsOverview(...args);
export const topProgress = (...args) => strengthAPI.topProgress(...args);
export const strengthCorrelations = (...args) => strengthAPI.strengthCorrelations(...args);
export const listWorkouts = (...args) => strengthAPI.listWorkouts(...args);
export const getWorkout = (...args) => strengthAPI.getWorkout(...args);
export const deleteWorkout = (...args) => strengthAPI.deleteWorkout(...args);
export const updateWorkout = (...args) => strengthAPI.updateWorkout(...args);
export const listTemplates = (...args) => strengthAPI.listTemplates(...args);
export const upsertTemplate = (...args) => strengthAPI.upsertTemplate(...args);
export const deleteTemplate = (...args) => strengthAPI.deleteTemplate(...args);
export const listMuscleGroups = (...args) => strengthAPI.listMuscleGroups(...args);
export const searchExercises = (...args) => strengthAPI.searchExercises(...args);
export const createWorkout = (...args) => strengthAPI.createWorkout(...args);
export const getSuggestion = (...args) => strengthAPI.getSuggestion(...args);
export const exerciseE1RMSeries = (...args) => strengthAPI.exerciseE1RMSeries(...args);
