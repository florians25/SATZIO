import type { AuthResponse, LoginInput, RegisterInput, UserView } from '@satzio/shared';
import { create } from 'zustand';
import { api, ApiError, applyAuth, clearNativeToken, onSessionChange, refreshSession, setAccessToken } from './api';
import { clearLocalData, db, kvGet, kvSet } from './db';
import { queryClient } from './query';

type Status = 'booting' | 'guest' | 'authed';

interface AuthState {
  status: Status;
  user: UserView | null;
  /** Angemeldet, aber Server nicht erreichbar (Offline-Modus mit zwischengespeichertem Profil). */
  offlineSession: boolean;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<UserView>;
  register: (input: RegisterInput) => Promise<UserView>;
  logout: (opts?: { everywhere?: boolean }) => Promise<void>;
  setUser: (u: UserView) => void;
}

/** Stellt sicher, dass lokale Daten zum angemeldeten Nutzer gehören. */
async function adoptUser(user: UserView) {
  const owner = await kvGet<string>('ownerId');
  if (owner && owner !== user.id) {
    await clearLocalData();
    queryClient.clear();
  }
  await kvSet('ownerId', user.id);
  await kvSet('me', user);
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'booting',
  user: null,
  offlineSession: false,

  async bootstrap() {
    const cached = await kvGet<UserView>('me');
    try {
      const r = await refreshSession();
      await adoptUser(r.user);
      set({ status: 'authed', user: r.user, offlineSession: false });
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork && cached) {
        // Offline: mit zwischengespeichertem Profil weiterarbeiten, Sync folgt bei Verbindung
        set({ status: 'authed', user: cached, offlineSession: true });
      } else {
        set({ status: 'guest', user: null, offlineSession: false });
      }
    }
  },

  async login(input) {
    const r = await api<AuthResponse>('/auth/login', { method: 'POST', body: input, noRefresh: true });
    applyAuth(r);
    await adoptUser(r.user);
    set({ status: 'authed', user: r.user, offlineSession: false });
    return r.user;
  },

  async register(input) {
    const r = await api<AuthResponse>('/auth/register', { method: 'POST', body: input, noRefresh: true });
    applyAuth(r);
    await adoptUser(r.user);
    set({ status: 'authed', user: r.user, offlineSession: false });
    return r.user;
  },

  async logout(opts) {
    try {
      if (opts?.everywhere) await api('/auth/logout-all', { method: 'POST' });
      else await api('/auth/logout', { method: 'POST', noRefresh: true });
    } catch {
      /* auch offline lokal abmelden */
    }
    setAccessToken(null);
    clearNativeToken();
    await clearLocalData();
    queryClient.clear();
    set({ status: 'guest', user: null, offlineSession: false });
  },

  setUser(user) {
    set({ user });
    void kvSet('me', user);
  },
}));

// Sitzung abgelaufen/widerrufen → abmelden; erneuert → Profil aktualisieren
onSessionChange((r) => {
  if (r) {
    useAuth.setState({ user: r.user, offlineSession: false, status: 'authed' });
    void kvSet('me', r.user);
  } else if (useAuth.getState().status === 'authed') {
    useAuth.setState({ status: 'guest', user: null });
  }
});

export async function pendingChangesCount(): Promise<number> {
  try {
    return await db.outbox.count();
  } catch {
    return 0;
  }
}
