const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  /** When true, returns the full JSON response envelope instead of unwrapping json.data */
  fullResponse?: boolean;
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, params, fullResponse } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Build headers with optional auth token
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const json = await res.json();

  if (!res.ok) {
    // If 401 and NOT on auth endpoints, clear auth and redirect to login
    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  // When fullResponse is true, return the full JSON envelope (useful for paginated endpoints)
  if (fullResponse) return json as T;
  // Otherwise, unwrap the envelope: the backend wraps data in { success, data, meta }
  // Return the data field directly for convenience, or the full response if no data
  return json.data ?? json;
}

export const api = {
  get: <T>(endpoint: string, params?: ApiOptions['params'], fullResponse?: boolean) =>
    request<T>(endpoint, { params, fullResponse }),

  post: <T>(endpoint: string, body: unknown, fullResponse?: boolean) =>
    request<T>(endpoint, { method: 'POST', body, fullResponse }),

  put: <T>(endpoint: string, body: unknown, fullResponse?: boolean) =>
    request<T>(endpoint, { method: 'PUT', body, fullResponse }),

  patch: <T>(endpoint: string, body: unknown, fullResponse?: boolean) =>
    request<T>(endpoint, { method: 'PATCH', body, fullResponse }),

  delete: <T>(endpoint: string, fullResponse?: boolean) =>
    request<T>(endpoint, { method: 'DELETE', fullResponse }),
};

export default api;