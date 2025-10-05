import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Predictions from './pages/Predictions';
import Sleep from './pages/Sleep';
import Sleeps from './pages/Sleeps';
import SleepDetail from './pages/SleepDetail';
import Days from './pages/Days';
import DayDetail from './pages/DayDetail';
import Today from './pages/Today';
import Stress from './pages/Stress';
import Activity from './pages/Activity';
import ActivityDetail from './pages/ActivityDetail';
import Running from './pages/Running';
import Gym from './pages/Gym';
import GymWorkouts from './pages/GymWorkouts';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import Assistant from './pages/Assistant';
import { HealthDataProvider } from './context/HealthDataContext';
import './App.css';

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
                  <Route path="/gym" element={<Gym />} />
                  <Route path="/gym/workouts" element={<GymWorkouts />} />
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