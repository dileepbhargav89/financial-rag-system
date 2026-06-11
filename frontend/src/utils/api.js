// src/utils/api.js
// Centralized Axios API client

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Default client — 3 min timeout for chat/insights
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 180_000,
  headers: { 'Content-Type': 'application/json' },
});

// Upload client — 15 min timeout for large PDF processing
// A 200-page PDF can take 5-8 minutes to extract, chunk, and embed in batches.
const uploadClient = axios.create({
  baseURL: API_BASE,
  timeout: 15 * 60 * 1000, // 15 minutes
});

// Consistent error formatting for both clients
const errorInterceptor = (error) => {
  const message =
    error.response?.data?.error ||
    error.message ||
    'An unexpected error occurred';
  return Promise.reject(new Error(message));
};

apiClient.interceptors.response.use((r) => r.data, errorInterceptor);
uploadClient.interceptors.response.use((r) => r.data, errorInterceptor);

/**
 * Upload a PDF file to the backend.
 * Uses a dedicated client with a 15-minute timeout to handle large PDFs.
 * @param {File} file
 * @param {function} onProgress - Progress callback (0-100)
 */
export async function uploadPDF(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  return await uploadClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress?.(pct);
      }
    },
  });
}

/**
 * Ask a question about uploaded documents.
 * @param {string} query
 * @param {Array} chatHistory
 */
export async function askQuestion(query, chatHistory = []) {
  return await apiClient.post('/ask', { query, chatHistory });
}

/**
 * Get pre-built financial insights.
 * @param {'summary'|'risks'} type
 */
export async function getInsights(type) {
  return await apiClient.post('/insights', { type });
}

/** Health check */
export async function healthCheck() {
  return await apiClient.get('/health');
}
