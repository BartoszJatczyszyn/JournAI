import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHealthData } from '../context/HealthDataContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { activitiesAPI } from '../services';

const Activity = () => {
  const { loading, error } = useHealthData();
  const [activities, setActivities] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setBusy(true);
        const res = await activitiesAPI.getLatestActivities(25);
        setActivities(res.activities || []);
      } catch (e) {
        console.error('Failed to load activities', e);
      } finally {
        setBusy(false);
      }
    };
    load();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Activity</h1>
        <p className="page-subtitle">Track your physical activity and exercise data</p>
      </div>
      
      <div className="page-content">
        {(busy && activities.length === 0) ? (
          <LoadingSpinner message="Loading latest activities..." />
        ) : null}
        {(error && activities.length === 0) ? (
          <ErrorMessage message={error} />
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Activity Overview Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Today's Activity</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Steps</span>
                  <span className="font-semibold">0 / 10,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Distance</span>
                  <span className="font-semibold">0.0 km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Calories</span>
                  <span className="font-semibold">0 kcal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Summary Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Weekly Summary</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Avg Steps/Day</span>
                  <span className="font-semibold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total Distance</span>
                  <span className="font-semibold">0.0 km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Active Days</span>
                  <span className="font-semibold">0 / 7</span>
                </div>
              </div>
            </div>
          </div>

          {/* Goals Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Activity Goals</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Daily Steps Goal</span>
                  <span className="font-semibold">10,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Weekly Distance Goal</span>
                  <span className="font-semibold">50 km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Goal Progress</span>
                  <span className="font-semibold text-green-600">0%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Activities List */}
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="card-title">Latest Activities</h3>
          </div>
          <div className="card-content">
            {activities.length === 0 ? (
              <div className="no-data">No recent activities found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Sport</th>
                      <th className="py-2 pr-4">Distance</th>
                      <th className="py-2 pr-4">Duration</th>
                      <th className="py-2 pr-4">Avg HR</th>
                      <th className="py-2 pr-4">Calories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a) => (
                      <tr key={a.activity_id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 pr-4">{a.start_time ? new Date(a.start_time).toLocaleString() : '-'}</td>
                        <td className="py-2 pr-4">
                          <Link className="text-blue-600" to={`/activity/${a.activity_id}`}>{a.name || 'Activity'}</Link>
                        </td>
                        <td className="py-2 pr-4">{a.sport || '-'}</td>
                        <td className="py-2 pr-4">{a.distance_km != null ? `${a.distance_km} km` : '-'}</td>
                        <td className="py-2 pr-4">{a.duration_min != null ? `${a.duration_min} min` : '-'}</td>
                        <td className="py-2 pr-4">{a.avg_hr || '-'}</td>
                        <td className="py-2 pr-4">{a.calories || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Activity;