import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getMyProfile } from '../api/userApi';
import type { MyProfile } from '../api/types';

interface UserCtx {
  profile: MyProfile | null;
  coins: number;
  setCoins: (c: number) => void;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserCtx>({
  profile: null,
  coins: 0,
  setCoins: () => {},
  refreshProfile: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [coins, setCoins] = useState(0);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      setCoins(p.coins);
    } catch {
      // not authenticated or network error
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    // Poll every 30s so the seller's balance updates when someone buys their
    // listing — the buyer's balance is updated immediately client-side but the
    // seller has no push mechanism.
    const interval = setInterval(refreshProfile, 30_000);

    // Also refresh on window focus: the seller is likely on another tab and
    // switches back to check their balance.
    window.addEventListener('focus', refreshProfile);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshProfile);
    };
  }, [refreshProfile]);

  return (
    <UserContext.Provider value={{ profile, coins, setCoins, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserCtx() {
  return useContext(UserContext);
}
