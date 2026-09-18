import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { TelemetryProvider } from './context/TelemetryContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <TelemetryProvider>
        <App />
      </TelemetryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
