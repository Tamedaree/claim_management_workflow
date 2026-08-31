import axios from "axios";
import { getToken, clearSession } from "@/lib/tokenStorage";

const API_BASE_URL = "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// Request Interceptor - Attach Token
api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // IMPORTANT:
    // Don't manually set Content-Type for FormData.
    // The browser/Axios will automatically set:
    // multipart/form-data; boundary=...
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor - Global Error Handling
api.interceptors.response.use(
  (response) => response,

  (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      clearSession();

      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default api;
