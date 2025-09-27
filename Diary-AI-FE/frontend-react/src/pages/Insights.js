import React from 'react';

const Insights = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Health Insights</h1>
        <p className="page-subtitle">AI-powered insights and recommendations for your health data</p>
      </div>
      
      <div className="page-content">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Key Insights Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Key Insights</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200">Sleep Pattern</h4>
                  <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                    Your sleep quality has improved by 15% this week compared to last week.
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Activity Level</h4>
                  <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                    You're consistently meeting your daily step goals. Keep it up!
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-500">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Stress Management</h4>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                    Consider incorporating more relaxation techniques during high-stress periods.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Personalized Recommendations</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Optimize Sleep Schedule</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Try going to bed 30 minutes earlier to improve sleep quality.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Increase Morning Activity</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Morning workouts can boost your energy levels throughout the day.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium">Stress Reduction</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Consider 10-minute meditation sessions during lunch breaks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Health Score Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Overall Health Score</h3>
            </div>
            <div className="card-content">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">85</div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Good Health</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sleep Quality</span>
                    <span className="font-medium">90%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Activity Level</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Stress Management</span>
                    <span className="font-medium">75%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trends Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Health Trends</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">This Week vs Last Week</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Sleep Quality</span>
                    <span className="text-sm font-medium text-green-600">+15%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Activity</span>
                    <span className="text-sm font-medium text-green-600">+8%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Stress Level</span>
                    <span className="text-sm font-medium text-red-600">+5%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Analysis Card */}
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="card-title">Detailed Analysis</h3>
          </div>
          <div className="card-content">
            <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">Detailed health analysis charts will be displayed here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insights;