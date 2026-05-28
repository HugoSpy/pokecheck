import { useState } from 'react';
import TradeAnimation3D from '../components/TradeAnimation3D';

const PRESETS = {
  normal: {
    given:    { sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',  name: 'Pikachu' },
    received: { sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png',   name: 'Dracaufeu' },
    shinyProc: false,
  },
  shiny: {
    given:    { sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png', name: 'Évoli' },
    received: { sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/150.png', name: 'Mewtwo' },
    shinyProc: true,
  },
  legendary: {
    given:    { sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png', name: 'Ronflex' },
    received: { sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/249.png', name: 'Lugia' },
    shinyProc: false,
  },
} as const;

type PresetKey = keyof typeof PRESETS;

export default function DevTradeAnim() {
  const [active, setActive] = useState<PresetKey | null>(null);
  const [key, setKey] = useState(0);

  function launch(preset: PresetKey) {
    setActive(null);
    setTimeout(() => { setActive(preset); setKey(k => k + 1); }, 50);
  }

  const preset = active ? PRESETS[active] : null;

  return (
    <>
      {preset && (
        <TradeAnimation3D
          key={key}
          givenPokemon={preset.given}
          receivedPokemon={preset.received}
          shinyProc={preset.shinyProc}
          shinyPokemonName={preset.shinyProc ? preset.received.name : undefined}
          onComplete={() => setActive(null)}
        />
      )}

      {!preset && (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: 'var(--bg-void, #03040a)',
          fontFamily: 'var(--font-display, "Chakra Petch", monospace)',
          color: 'var(--text-primary, #e6e8f2)',
        }}>
          <h1 style={{ fontSize: '1.3rem', letterSpacing: '0.1em', marginBottom: 8 }}>
            🎬 Test — cinématique d'échange
          </h1>
          {(Object.keys(PRESETS) as PresetKey[]).map(p => (
            <button
              key={p}
              onClick={() => launch(p)}
              style={{
                padding: '12px 32px',
                background: 'var(--bg-card, #0d0e18)',
                border: '1px solid var(--border-bright, rgba(255,255,255,0.12))',
                borderRadius: 8,
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                letterSpacing: '0.08em',
                transition: 'background 0.2s',
              }}
            >
              {p === 'shiny' ? '✨ Shiny proc' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
