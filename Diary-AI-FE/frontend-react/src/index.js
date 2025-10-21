import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Chart as ChartJS } from 'chart.js/auto';
import { chartJsDefaults } from './utils/chartTheme';

// Apply global Chart.js defaults for consistent theming
try { ChartJS.defaults.set(chartJsDefaults); } catch (e) { /* optional */ }

document.documentElement.classList.add('dark');
document.body && document.body.classList && document.body.classList.add('dark');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);