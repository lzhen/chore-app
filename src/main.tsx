import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionApp } from './components/SessionApp';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SessionApp />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
