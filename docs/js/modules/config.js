/**
 * config.js
 * Shared configuration for the application.
 */

// Detect access environment
const isProduction = window.location.hostname.includes('github.io') || window.location.hostname.includes('onrender.com');

// Centralized API Base URL
export const API_BASE_URL = isProduction
    ? 'https://turnos-app-8viu.onrender.com'
    : 'http://localhost:3001';

export const APP_VERSION = '1.0.0';
