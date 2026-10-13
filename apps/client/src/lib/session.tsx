import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiUrl } from './api';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN';
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function apiRequest<T>(path: `/api/${string}`, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('filmiliar_token');
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.message || 'Yêu cầu không thành công', response.status);
  return result as T;
}

type SessionState = 'loading' | 'guest' | 'ready' | 'error';
interface SessionContextValue {
  user: SessionUser | null;
  state: SessionState;
  signIn: (token: string, user: SessionUser) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
  updateUser: (user: SessionUser) => void;
  updateToken: (token: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<SessionState>('loading');

  const signOut = useCallback(() => {
    localStorage.removeItem('filmiliar_token');
    localStorage.removeItem('filmiliar_user');
    setUser(null);
    setState('guest');
  }, []);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('filmiliar_token')) {
      setUser(null);
      setState('guest');
      return;
    }
    setState('loading');
    try {
      const result = await apiRequest<{ user: SessionUser }>('/api/auth/me');
      setUser(result.user);
      setState('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) signOut();
      else setState('error');
    }
  }, [signOut]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<SessionContextValue>(() => ({
    user, state, signOut, refresh,
    signIn: (token, nextUser) => {
      localStorage.setItem('filmiliar_token', token);
      localStorage.removeItem('filmiliar_user');
      setUser(nextUser);
      setState('ready');
    },
    updateUser: (nextUser) => setUser(nextUser),
    updateToken: (token) => localStorage.setItem('filmiliar_token', token)
  }), [user, state, signOut, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider missing');
  return value;
}
