import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './features/dashboard/pages/Dashboard';
import Analytics from './features/analytics/pages/Analytics';
import Predictions from './features/predictions/pages/Predictions';
import Sleep from './features/sleep/pages/Sleep';
import Sleeps from './features/sleep/pages/Sleeps';
import SleepDetail from './features/sleep/pages/SleepDetail';
import Days from './features/days/pages/Days';
import DayDetail from './features/days/pages/DayDetail';
import Today from './features/today/pages/Today';
import Stress from './features/stress/pages/Stress';
import Activity from './features/activities/pages/Activity';
import ActivityDetail from './features/activities/pages/ActivityDetail';
import Running from './features/running/pages/Running';
import Walking from './features/walking/pages/Walking';
import Cycling from './features/cycling/pages/Cycling';
import Hiking from './features/hiking/pages/Hiking';
import Swimming from './features/swimming/pages/Swimming';
import Gym from './features/gym/pages/Gym';
import GymWorkouts from './features/gym/pages/GymWorkouts';
import GymWorkoutDetail from './features/gym/pages/GymWorkoutDetail';
import StrengthWorkoutForm from './features/strength/pages/StrengthWorkoutForm';
import StrengthAnalytics from './features/strength/pages/StrengthAnalytics';
import ExerciseAnalysis from './features/strength/pages/ExerciseAnalysis';
import MuscleGroupAnalysis from './features/strength/pages/MuscleGroupAnalysis';
import Insights from './features/insights/pages/Insights';
import Settings from './features/settings/pages/Settings';
import Assistant from './features/assistant/pages/Assistant';
import { HealthDataProvider } from './app/providers/HealthDataProvider';
import './App.css';
import TooltipStyles from './components/TooltipStyles';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Default to dark mode unless user explicitly chose light
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme !== 'light') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
      if (!savedTheme) {
        localStorage.setItem('theme', 'dark');
      }
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <HealthDataProvider>
      <Router>
          <TooltipStyles />
        <div className={`app ${darkMode ? 'dark' : ''}`}>
          <Navbar 
            onToggleSidebar={toggleSidebar}
            onToggleDarkMode={toggleDarkMode}
            darkMode={darkMode}
          />
          
          <div className="app-layout">
            <Sidebar 
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
            
            <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
              <div className="container">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/predictions" element={<Predictions />} />
                  <Route path="/sleep" element={<Sleep />} />
                  <Route path="/sleeps" element={<Sleeps />} />
                  <Route path="/sleep/:id" element={<SleepDetail />} />
                  <Route path="/days" element={<Days />} />
                  <Route path="/days/:day" element={<DayDetail />} />
                  <Route path="/today" element={<Today />} />
                  <Route path="/stress" element={<Stress />} />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/activity/:id" element={<ActivityDetail />} />
                  <Route path="/running" element={<Running />} />
                  <Route path="/walking" element={<Walking />} />
                  <Route path="/cycling" element={<Cycling />} />
                  <Route path="/hiking" element={<Hiking />} />
                  <Route path="/swimming" element={<Swimming />} />
                  <Route path="/gym" element={<Gym />} />
                  <Route path="/gym/workouts" element={<GymWorkouts />} />
                  <Route path="/gym/workouts/:id" element={<GymWorkoutDetail />} />
                  <Route path="/strength/workout/new" element={<StrengthWorkoutForm />} />
                  <Route path="/strength/analytics" element={<StrengthAnalytics />} />
                  <Route path="/strength/exercise/:id" element={<ExerciseAnalysis />} />
                  <Route path="/strength/muscle/:id" element={<MuscleGroupAnalysis />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/assistant" element={<Assistant />} />
                </Routes>
              </div>
            </main>
          </div>
          
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: darkMode ? '#1f2937' : '#ffffff',
                color: darkMode ? '#f9fafb' : '#1f2937',
                border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
              },
            }}
          />
        </div>
      </Router>
    </HealthDataProvider>
  );
}

export default App;