import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import type { AuthUser } from '@/types';

// ─── API Base ───
const API_BASE = '/api/auth';

// ─── Token helpers ───
function getToken(): string | null {
  return localStorage.getItem('mathhub_token');
}

function setToken(token: string) {
  localStorage.setItem('mathhub_token', token);
}

function removeToken() {
  localStorage.removeItem('mathhub_token');
}

// ─── API calls ───
async function apiLogin(username: string, password: string): Promise<{ success: boolean; user?: AuthUser; token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return await res.json();
  } catch {
    return { success: false, error: '网络错误，请检查服务器连接' };
  }
}

async function apiRegister(username: string, password: string, displayName: string): Promise<{ success: boolean; user?: AuthUser; token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName }),
    });
    return await res.json();
  } catch {
    return { success: false, error: '网络错误，请检查服务器连接' };
  }
}

async function apiGetMe(): Promise<{ user?: AuthUser; error?: string }> {
  const token = getToken();
  if (!token) return {};
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      removeToken();
      return {};
    }
    return await res.json();
  } catch {
    return {};
  }
}

async function apiUpdateProfile(data: Partial<AuthUser>): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const token = getToken();
  if (!token) return { success: false, error: '未登录' };
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return { success: false, error: '网络错误' };
  }
}

// ─── Auth Context ───
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginFn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerFn: (username: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logoutFn: () => void;
  updateProfile: (data: Partial<AuthUser>) => Promise<{ success: boolean; error?: string }>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginFn: async () => ({ success: false }),
  registerFn: async () => ({ success: false }),
  logoutFn: () => {},
  updateProfile: async () => ({ success: false }),
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await apiGetMe();
    if (result.user) {
      setUser(result.user);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  // On mount, try to restore session from token
  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginFn = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    if (result.success && result.user && result.token) {
      setToken(result.token);
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const registerFn = useCallback(async (username: string, password: string, displayName: string) => {
    const result = await apiRegister(username, password, displayName);
    if (result.success && result.user && result.token) {
      setToken(result.token);
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  const logoutFn = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthUser>) => {
    const result = await apiUpdateProfile(data);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return { success: result.success, error: result.error };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginFn, registerFn, logoutFn, updateProfile, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
