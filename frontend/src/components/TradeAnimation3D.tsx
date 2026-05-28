import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './TradeAnimation3D.css';

// ── Timing constants (ms) ──────────────────────────────────────────────────
const TIMINGS = {
  SPARKLE_COVER:    1000,
  SPRITE_DISSOLVE:   800,
  POKEBALL_FORM:     600,
  POKEBALL_ASCEND:  1200,
  POKEBALL_DESCEND: 1200,
  POKEBALL_OPEN:     600,
  POKEMON_EMERGE:   1000,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────
function getSlugFromSpriteUrl(spriteUrl: string): string {
  return spriteUrl.split('/').pop()?.replace('.png', '') ?? '';
}

// ── Types ──────────────────────────────────────────────────────────────────
type Phase =
  | 'sparkle-cover'
  | 'dissolve'
  | 'pokeball-form'
  | 'ascend'
  | 'descend'
  | 'open'
  | 'emerge'
  | 'result';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  delay: number;
  size: number;
  dur: number;
  gold: boolean;
}

interface StarDot {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  dur: number;
  delay: number;
}

export type Props = {
  givenPokemon: { sprite_url: string; name: string };
  receivedPokemon: { sprite_url: string; name: string };
  shinyProc?: boolean;
  shinyPokemonName?: string;
  onComplete: () => void;
};

// ── Easing ─────────────────────────────────────────────────────────────────
function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Generators ─────────────────────────────────────────────────────────────
function genSparkles(count: number, gold = false): Sparkle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const r = 30 + Math.random() * 65;
    return {
      id: i,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      delay: Math.random() * 0.85,
      size: 5 + Math.random() * 7,
      dur: 0.45 + Math.random() * 0.5,
      gold,
    };
  });
}

function genStars(count: number): StarDot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 0.5 + Math.random() * 1.8,
    opacity: 0.15 + Math.random() * 0.55,
    dur: 2 + Math.random() * 3,
    delay: Math.random() * 4,
  }));
}

// ── Fallback pokéball (sphère) ─────────────────────────────────────────────
function buildFallbackPokeball(group: THREE.Group): void {
  console.warn('pokeball.glb manquant — fallback sphère utilisée');

  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xee1515 }),
  );
  group.add(top);

  const bot = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xfafafa }),
  );
  group.add(bot);

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.045, 8, 64),
    new THREE.MeshStandardMaterial({ color: 0x111111 }),
  );
  band.rotation.x = Math.PI / 2;
  group.add(band);

  const btn = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xfafafa }),
  );
  btn.position.set(0, 0, 0.51);
  group.add(btn);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function TradeAnimation3D({
  givenPokemon,
  receivedPokemon,
  shinyProc = false,
  shinyPokemonName,
  onComplete,
}: Props) {
  // ── Refs
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const phaseRef         = useRef<Phase>('sparkle-cover');
  const phaseStartRef    = useRef(0);
  const timersRef        = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef           = useRef(0);
  const wrapperRef       = useRef<THREE.Group | null>(null);
  const closedMeshesRef  = useRef<THREE.Object3D[]>([]);
  const openedMeshesRef  = useRef<THREE.Object3D[]>([]);

  // ── State
  const [phase,         setPhase]         = useState<Phase>('sparkle-cover');
  const [sparkles,      setSparkles]      = useState<Sparkle[]>(() => genSparkles(30));
  const [showFlash,     setShowFlash]     = useState(false);
  const [flashGold,     setFlashGold]     = useState(false);
  const [showShinyText, setShowShinyText] = useState(false);
  const [stars]                           = useState<StarDot[]>(() => genStars(55));

  const givenSlug    = getSlugFromSpriteUrl(givenPokemon.sprite_url);
  const receivedSlug = getSlugFromSpriteUrl(receivedPokemon.sprite_url);
  const [givenImgSrc,    setGivenImgSrc]    = useState(
    `https://projectpokemon.org/images/normal-sprite/${givenSlug}.gif`
  );
  const [receivedImgSrc, setReceivedImgSrc] = useState(
    shinyProc
      ? `https://projectpokemon.org/images/shiny-sprite/${receivedSlug}.gif`
      : `https://projectpokemon.org/images/normal-sprite/${receivedSlug}.gif`
  );

  // ── Helpers
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const advanceTo = useCallback((next: Phase, delay: number) => {
    addTimer(() => {
      phaseRef.current = next;
      phaseStartRef.current = performance.now();
      setPhase(next);
    }, delay);
  }, [addTimer]);

  const handleSkip = useCallback(() => {
    clearTimers();
    cancelAnimationFrame(rafRef.current);
    phaseRef.current = 'result';
    setPhase('result');
  }, [clearTimers]);

  // ── Phase state machine ───────────────────────────────────────────────────
  useEffect(() => {
    switch (phase) {
      case 'sparkle-cover':
        advanceTo('dissolve',      TIMINGS.SPARKLE_COVER);
        break;

      case 'dissolve':
        advanceTo('pokeball-form', TIMINGS.SPRITE_DISSOLVE);
        break;

      case 'pokeball-form':
        advanceTo('ascend',        TIMINGS.POKEBALL_FORM);
        break;

      case 'ascend':
        advanceTo('descend',       TIMINGS.POKEBALL_ASCEND);
        break;

      case 'descend':
        advanceTo('open',          TIMINGS.POKEBALL_DESCEND);
        break;

      case 'open': {
        // Flash blanc → switch closed→opened
        addTimer(() => { setShowFlash(true); setFlashGold(false); }, 220);
        addTimer(() => {
          setShowFlash(false);
          closedMeshesRef.current.forEach(m => { m.visible = false; });
          openedMeshesRef.current.forEach(m => { m.visible = true; });
        }, 420);
        advanceTo('emerge', TIMINGS.POKEBALL_OPEN);
        break;
      }

      case 'emerge':
        setSparkles(genSparkles(30, shinyProc));
        if (shinyProc) {
          addTimer(() => { setShowFlash(true); setFlashGold(true); }, 320);
          addTimer(() => { setShowFlash(false); setShowShinyText(true); }, 650);
        }
        advanceTo('result', TIMINGS.POKEMON_EMERGE);
        break;

      case 'result':
        break;
    }

    return clearTimers;
  }, [phase, advanceTo, addTimer, clearTimers, shinyProc]);

  // ── Three.js setup (once) ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scene + camera + renderer
    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(2, 3, 4);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-2, -1, 2);
    scene.add(fill);

    // Pokéball wrapper (position/rotation animés)
    const wrapper = new THREE.Group();
    wrapper.visible = false;
    scene.add(wrapper);
    wrapperRef.current = wrapper;

    // Charger le GLB
    const loader = new GLTFLoader();
    loader.load(
      '/models/pokeball.glb',
      (gltf) => {
        const root = gltf.scene;

        const btn001 = root.getObjectByName('button_low001');
        const bot001 = root.getObjectByName('bottom_low001');
        const btn010 = root.getObjectByName('button_low010');
        const bot010 = root.getObjectByName('bottom_low010');

        // Masquer les meshes opened AVANT tout calcul de bbox
        if (btn010) btn010.visible = false;
        if (bot010) bot010.visible = false;

        // Normaliser la taille sur les meshes fermées uniquement
        root.updateMatrixWorld(true);
        const closedBox = new THREE.Box3();
        if (btn001) closedBox.expandByObject(btn001);
        if (bot001) closedBox.expandByObject(bot001);

        // Fallback sur toute la scène si les noms ne correspondent pas
        if (closedBox.isEmpty()) new THREE.Box3().setFromObject(root);

        const size = closedBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) root.scale.setScalar(1.4 / maxDim);

        // Recalculer après scale pour centrer correctement
        root.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3();
        if (btn001) scaledBox.expandByObject(btn001);
        if (bot001) scaledBox.expandByObject(bot001);
        if (scaledBox.isEmpty()) scaledBox.setFromObject(root);

        const center = scaledBox.getCenter(new THREE.Vector3());
        root.position.sub(center);

        wrapper.add(root);

        if (btn001 && bot001) closedMeshesRef.current = [btn001, bot001];
        if (btn010 && bot010) openedMeshesRef.current = [btn010, bot010];
      },
      undefined,
      () => { buildFallbackPokeball(wrapper); },
    );

    // Animation loop
    function animatePokeball(ts: number): void {
      const pw = wrapperRef.current;
      if (!pw) return;

      const p       = phaseRef.current;
      const elapsed = ts - phaseStartRef.current;

      if (p === 'sparkle-cover' || p === 'dissolve') {
        pw.visible = false;
        return;
      }

      pw.visible = true;

      if (p === 'pokeball-form') {
        const t = Math.min(elapsed / TIMINGS.POKEBALL_FORM, 1);
        pw.scale.setScalar(Math.max(easeOutBack(t) * 0.85, 0));
        pw.position.y = 0;
        pw.rotation.y += 0.025;
      } else if (p === 'ascend') {
        const t = Math.min(elapsed / TIMINGS.POKEBALL_ASCEND, 1);
        pw.scale.setScalar(0.85 * (1 - t * 0.25));
        pw.position.y = easeInOutCubic(t) * 5.5;
        pw.rotation.y += 0.07;
      } else if (p === 'descend') {
        const t = Math.min(elapsed / TIMINGS.POKEBALL_DESCEND, 1);
        pw.scale.setScalar(0.85 * (0.75 + t * 0.25));
        pw.position.y = (1 - easeOutCubic(t)) * 5.5;
        pw.rotation.y += 0.03;
      } else if (p === 'open') {
        pw.scale.setScalar(0.85);
        pw.position.y = 0;
        pw.rotation.y += 0.03;
      } else if (p === 'emerge' || p === 'result') {
        // Fondu disparition
        const t = Math.min(elapsed / 380, 1);
        pw.scale.setScalar(0.85 * (1 - t));
        pw.position.y = 0;
        pw.rotation.y += 0.02;
      }
    }

    function animate(ts: number): void {
      rafRef.current = requestAnimationFrame(animate);
      animatePokeball(ts);
      renderer.render(scene, camera);
    }
    rafRef.current = requestAnimationFrame(animate);

    function onResize(): void {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render: écran de résultat ─────────────────────────────────────────────
  if (phase === 'result') {
    return (
      <div className="trade-anim-result">
        <div className="trade-anim-result-inner">
          <h2 className="trade-anim-result-title">Échange réussi !</h2>

          {shinyProc && (
            <p className="trade-anim-shiny-badge">
              ✨ {shinyPokemonName ?? receivedPokemon.name} est SHINY !
            </p>
          )}

          <div className="trade-anim-result-row">
            <div className="trade-anim-result-poke">
              <img src={givenPokemon.sprite_url} alt={givenPokemon.name} />
              <span className="trade-anim-result-poke-name">{givenPokemon.name}</span>
              <span className="trade-anim-result-label">Échangé</span>
            </div>

            <div className="trade-anim-result-arrow">→</div>

            <div className={`trade-anim-result-poke received${shinyProc ? ' is-shiny' : ''}`}>
              <img src={receivedPokemon.sprite_url} alt={receivedPokemon.name} />
              <span className="trade-anim-result-poke-name">{receivedPokemon.name}</span>
              <span className="trade-anim-result-label">Reçu</span>
            </div>
          </div>

          <button className="trade-anim-continue-btn" onClick={onComplete}>
            Continuer
          </button>
        </div>
      </div>
    );
  }

  // ── Render: cinématique ───────────────────────────────────────────────────
  const showGiven    = phase === 'sparkle-cover' || phase === 'dissolve';
  const showReceived = phase === 'emerge';
  const dissolving   = phase === 'dissolve';

  const bgClass = [
    'trade-anim-bg',
    `trade-anim-bg--${phase}`,
    shinyProc && (phase === 'emerge') ? 'trade-anim-bg--shiny' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="trade-anim-root">
      {/* Fond animé */}
      <div className={bgClass} />

      {/* Étoiles de fond */}
      <div className="trade-anim-stars">
        {stars.map(s => (
          <div
            key={s.id}
            className="trade-anim-star"
            style={{
              left:              `${s.x}%`,
              top:               `${s.y}%`,
              width:             `${s.size}px`,
              height:            `${s.size}px`,
              opacity:           s.opacity,
              animationDuration: `${s.dur}s`,
              animationDelay:    `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Canvas Three.js */}
      <canvas ref={canvasRef} className="trade-anim-canvas" />

      {/* Overlay HTML */}
      <div className="trade-anim-overlay">

        {/* Sprite Pokémon donné */}
        {showGiven && (
          <div className={`trade-anim-sprite-wrap ${dissolving ? 'dissolving' : 'entering'}`}>
            <img
              src={givenImgSrc}
              onError={() => setGivenImgSrc(givenPokemon.sprite_url)}
              alt={givenPokemon.name}
              className="trade-anim-sprite"
            />
            <div className="trade-anim-sparkle-ring">
              {sparkles.map(s => (
                <span
                  key={s.id}
                  className={`trade-anim-sparkle ${dissolving ? 'burst' : 'appear'}`}
                  style={{
                    left:              `calc(50% + ${s.x}px)`,
                    top:               `calc(50% + ${s.y}px)`,
                    width:             `${s.size}px`,
                    height:            `${s.size}px`,
                    animationDelay:    `${s.delay}s`,
                    animationDuration: `${s.dur}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sprite Pokémon reçu */}
        {showReceived && (
          <div className={`trade-anim-sprite-wrap emerging${shinyProc ? ' shiny-glow' : ''}`}>
            <img
              src={receivedImgSrc}
              onError={() => setReceivedImgSrc(receivedPokemon.sprite_url)}
              alt={receivedPokemon.name}
              className="trade-anim-sprite"
            />
            <div className="trade-anim-sparkle-ring">
              {sparkles.map(s => (
                <span
                  key={s.id}
                  className={`trade-anim-sparkle emerge-sparkle${s.gold ? ' gold' : ''}`}
                  style={{
                    left:              `calc(50% + ${s.x}px)`,
                    top:               `calc(50% + ${s.y}px)`,
                    width:             `${s.size}px`,
                    height:            `${s.size}px`,
                    animationDelay:    `${s.delay * 0.4}s`,
                    animationDuration: `${s.dur}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Flash */}
        {showFlash && (
          <div className={`trade-anim-flash ${flashGold ? 'gold' : 'white'}`} />
        )}

        {/* Texte SHINY */}
        {showShinyText && (
          <div className="trade-anim-shiny-text">✨ SHINY !</div>
        )}
      </div>

      {/* Bouton Passer */}
      <button className="trade-anim-skip" onClick={handleSkip}>
        Passer →
      </button>
    </div>
  );
}
