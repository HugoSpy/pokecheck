import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  async function refreshProfile() {
    try {
      const p = await getMyProfile();
      setProfile(p);
      setCoins(p.coins);
    } catch {
      // not authenticated or network error
    }
  }

  useEffect(() => { refreshProfile(); }, []);

  return (
    <UserContext.Provider value={{ profile, coins, setCoins, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserCtx() {
  return useContext(UserContext);
}
