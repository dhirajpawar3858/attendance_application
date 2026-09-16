// Central app state: current user, theme, organisations, current org. (Light-only.)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client.ts';
import type { Org, User } from '../api/types.ts';
import { DEFAULT_THEME, normalizeTheme } from '../theme/themes.ts';

interface AppCtx {
  user: User | null;
  loading: boolean;
  orgs: Org[];
  currentOrg: Org | null;
  theme: string;
  setUser: (u: User | null) => void;
  refreshMe: () => Promise<void>;
  refreshOrgs: () => Promise<Org[]>;
  setCurrentOrg: (o: Org) => void;
  applyTheme: (theme: string, persist?: boolean) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);
const LS_ORG = 'att.currentOrgId';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Org | null>(null);
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const applyTheme = useCallback((t: string, persist = false) => {
    const id = normalizeTheme(t);
    setTheme(id);
    document.documentElement.setAttribute('data-theme', id);
    if (persist) {
      api.put('/auth/settings', { theme: id }).catch(() => {});
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const { user } = await api.get<{ user: User | null }>('/auth/me');
    setUser(user);
    if (user) {
      applyTheme(normalizeTheme(user.settings?.theme as string));
    }
  }, [applyTheme]);

  const refreshOrgs = useCallback(async () => {
    const list = await api.get<Org[]>('/orgs');
    setOrgs(list);
    // pick stored org or first
    const storedId = Number(localStorage.getItem(LS_ORG));
    const found = list.find((o) => o.id === storedId) || list[0] || null;
    setCurrentOrgState(found);
    return list;
  }, []);

  const setCurrentOrg = useCallback((o: Org) => {
    setCurrentOrgState(o);
    localStorage.setItem(LS_ORG, String(o.id));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    setOrgs([]);
    setCurrentOrgState(null);
  }, []);

  useEffect(() => {
    // apply default theme immediately so the login screen is themed
    document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
    (async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when user logs in, load orgs
  useEffect(() => {
    if (user) refreshOrgs().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo<AppCtx>(
    () => ({
      user,
      loading,
      orgs,
      currentOrg,
      theme,
      setUser,
      refreshMe,
      refreshOrgs,
      setCurrentOrg,
      applyTheme,
      logout,
    }),
    [user, loading, orgs, currentOrg, theme, refreshMe, refreshOrgs, setCurrentOrg, applyTheme, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used within AppStateProvider');
  return c;
}
