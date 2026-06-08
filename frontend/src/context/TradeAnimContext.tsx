import { createContext, useContext, useState, ReactNode } from 'react';
import TradeAnimation3D from '../components/TradeAnimation3D';
import type { Props as TradeAnimProps } from '../components/TradeAnimation3D';

type AnimState = Omit<TradeAnimProps, 'onComplete'>;

interface TradeAnimCtx {
  triggerTradeAnim: (props: AnimState) => void;
}

const TradeAnimContext = createContext<TradeAnimCtx>({ triggerTradeAnim: () => {} });

export function TradeAnimProvider({ children }: { children: ReactNode }) {
  const [anim, setAnim] = useState<AnimState | null>(null);

  return (
    <TradeAnimContext.Provider value={{ triggerTradeAnim: setAnim }}>
      {children}
      {anim && (
        <TradeAnimation3D
          {...anim}
          onComplete={() => setAnim(null)}
        />
      )}
    </TradeAnimContext.Provider>
  );
}

export function useTradeAnim() {
  return useContext(TradeAnimContext);
}
