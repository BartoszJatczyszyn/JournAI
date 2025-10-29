// Activities feature API facade
import infra from 'infrastructure/api/activities';
import { mapActivityDtoToModel, mapActivitiesDtoToModel } from 'entities/activities/model';

export const activitiesAPI = {
  async getLatestActivities(limit = 500) {
    const res = await infra.getLatestActivities(limit);
    // Backwards-compatible: many UI components expect the raw DTO shape
    // (fields like activity_id, start_time, distance_km). Expose both the
    // raw DTO array as `activities` and a mapped domain model as `mappedActivities`.
    const rawActivities = res?.activities || res || [];
    const mapped = mapActivitiesDtoToModel(Array.isArray(rawActivities) ? rawActivities : []);
    return {
      activities: rawActivities,
      mappedActivities: mapped,
      total_count: res?.total_count ?? res?.count ?? (Array.isArray(rawActivities) ? rawActivities.length : 0),
    };
  },
  async getActivityById(id) {
    const dto = await infra.getActivityById(id);
    return mapActivityDtoToModel(dto);
  },
  async getActivitiesRange(start, end) {
    const res = await infra.getActivitiesRange(start, end);
    return mapActivitiesDtoToModel(res?.activities || res || []);
  },
};

export default activitiesAPI;
