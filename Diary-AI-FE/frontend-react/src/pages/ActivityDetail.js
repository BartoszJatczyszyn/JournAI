import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { activitiesAPI } from '../services';

const ActivityDetail = () => {
  const { id } = useParams();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await activitiesAPI.getActivityById(id);
        setActivity(res.activity);
      } catch (e) {
        setError('Failed to load activity');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading && !activity) return <LoadingSpinner message="Loading activity..." />;
  if (error && !activity) return <ErrorMessage message={error} />;
  if (!activity) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{activity.name || 'Activity'} ({activity.sport || '-'})</h1>
        <p className="page-subtitle">{activity.start_time ? new Date(activity.start_time).toLocaleString() : ''}</p>
        <Link to="/activity" className="btn btn-secondary">← Back to activities</Link>
      </div>

      <div className="page-content grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Summary</h3></div>
          <div className="card-content">
            <ul className="space-y-2">
              <li><strong>Distance:</strong> {activity.distance_km != null ? `${activity.distance_km} km` : '-'}</li>
              <li><strong>Duration:</strong> {activity.duration_min != null ? `${activity.duration_min} min` : '-'}</li>
              <li><strong>Avg HR:</strong> {activity.avg_hr || '-'}</li>
              <li><strong>Max HR:</strong> {activity.max_hr || '-'}</li>
              <li><strong>Calories:</strong> {activity.calories || '-'}</li>
              <li><strong>Avg Pace:</strong> {activity.avg_pace_min_per_km != null ? `${activity.avg_pace_min_per_km} min/km` : '-'}</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Performance</h3></div>
          <div className="card-content">
            <ul className="space-y-2">
              <li><strong>Avg Speed:</strong> {activity.avg_speed != null ? `${activity.avg_speed.toFixed(2)} m/s` : '-'}</li>
              <li><strong>Max Speed:</strong> {activity.max_speed != null ? `${activity.max_speed.toFixed(2)} m/s` : '-'}</li>
              <li><strong>Training Load:</strong> {activity.training_load || '-'}</li>
              <li><strong>Training Effect:</strong> {activity.training_effect || '-'}</li>
              <li><strong>Anaerobic Effect:</strong> {activity.anaerobic_training_effect || '-'}</li>
            </ul>
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="card-header"><h3 className="card-title">More Details</h3></div>
          <div className="card-content">
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(activity, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityDetail;
