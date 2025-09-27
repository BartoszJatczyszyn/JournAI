import React, { useState } from 'react';

const Settings = () => {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      sms: false,
    },
    privacy: {
      dataSharing: false,
      analytics: true,
    },
    preferences: {
      units: 'metric',
      language: 'en',
      theme: 'auto',
    },
    goals: {
      dailySteps: 10000,
      sleepHours: 8,
      waterIntake: 2000,
    },
  });

  const handleNotificationChange = (type) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }));
  };

  const handlePrivacyChange = (type) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [type]: !prev.privacy[type]
      }
    }));
  };

  const handlePreferenceChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      }
    }));
  };

  const handleGoalChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      goals: {
        ...prev.goals,
        [key]: parseInt(value) || 0
      }
    }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize your health tracking experience</p>
      </div>
      
      <div className="page-content">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notifications Settings */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Notifications</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium">Email Notifications</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive health insights via email</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={() => handleNotificationChange('email')}
                    className="toggle"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium">Push Notifications</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get reminders and alerts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={() => handleNotificationChange('push')}
                    className="toggle"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium">SMS Notifications</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive important alerts via SMS</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.sms}
                    onChange={() => handleNotificationChange('sms')}
                    className="toggle"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Privacy</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium">Data Sharing</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Share anonymized data for research</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.privacy.dataSharing}
                    onChange={() => handlePrivacyChange('dataSharing')}
                    className="toggle"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium">Analytics</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Help improve the app with usage data</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.privacy.analytics}
                    onChange={() => handlePrivacyChange('analytics')}
                    className="toggle"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Preferences</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-2">Units</label>
                  <select
                    value={settings.preferences.units}
                    onChange={(e) => handlePreferenceChange('units', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  >
                    <option value="metric">Metric (kg, km, °C)</option>
                    <option value="imperial">Imperial (lbs, miles, °F)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-2">Language</label>
                  <select
                    value={settings.preferences.language}
                    onChange={(e) => handlePreferenceChange('language', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-2">Theme</label>
                  <select
                    value={settings.preferences.theme}
                    onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  >
                    <option value="auto">Auto</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Goals Settings */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Health Goals</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-2">Daily Steps Goal</label>
                  <input
                    type="number"
                    value={settings.goals.dailySteps}
                    onChange={(e) => handleGoalChange('dailySteps', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                    min="1000"
                    max="50000"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-2">Sleep Hours Goal</label>
                  <input
                    type="number"
                    value={settings.goals.sleepHours}
                    onChange={(e) => handleGoalChange('sleepHours', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                    min="4"
                    max="12"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-2">Water Intake Goal (ml)</label>
                  <input
                    type="number"
                    value={settings.goals.waterIntake}
                    onChange={(e) => handleGoalChange('waterIntake', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                    min="500"
                    max="5000"
                    step="250"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="card-title">Account</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="btn btn-primary">
                Export Data
              </button>
              <button className="btn btn-secondary">
                Reset Settings
              </button>
              <button className="btn btn-danger">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;