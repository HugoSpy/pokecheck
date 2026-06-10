import React from 'react';

interface PokeballProps {
  size?: number;
  rotation?: number;
  glowOpacity?: number;
  openProgress?: number; // 0 = closed, 1 = fully open (top half flips up)
}

export const Pokeball: React.FC<PokeballProps> = ({
  size = 140,
  rotation = 0,
  glowOpacity = 0,
  openProgress = 0,
}) => {
  const s = size / 140;
  const topAngle = openProgress * -80;
  const bottomAngle = openProgress * 80;
  const innerGlow = openProgress > 0
    ? `radial-gradient(circle, rgba(255,255,255,${openProgress * 0.9}) 0%, rgba(255,200,100,${openProgress * 0.6}) 40%, transparent 70%)`
    : 'none';

  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `rotate(${rotation}deg)` }}>
      {/* Main ball */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: `${3 * s}px solid rgba(255,255,255,0.12)`,
        overflow: 'hidden',
      }}>
        {/* Top red half */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '50%',
          background: 'linear-gradient(135deg, #e53e3e, #c53030)',
          transformOrigin: 'bottom center',
          transform: `rotateX(${topAngle}deg)`,
        }} />
        {/* Band */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 8 * s, marginTop: -4 * s,
          background: '#111',
          zIndex: 2,
        }} />
        {/* Bottom dark half */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '50%',
          background: 'linear-gradient(135deg, #1e2231, #111827)',
          transformOrigin: 'top center',
          transform: `rotateX(${bottomAngle}deg)`,
        }} />
        {/* Inner glow when opening */}
        {openProgress > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: innerGlow,
            zIndex: 3,
          }} />
        )}
        {/* Center button circle */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 34 * s, height: 34 * s,
          borderRadius: '50%',
          background: '#111',
          border: `${4 * s}px solid #2a2a2a`,
          zIndex: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 16 * s, height: 16 * s,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f0f4f8, #c3cfe2)',
            boxShadow: `0 0 ${8 * s}px rgba(255,255,255,0.4)`,
          }} />
        </div>
      </div>

      {/* Ambient glow ring */}
      {glowOpacity > 0 && (
        <div style={{
          position: 'absolute',
          inset: -32 * s,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 65%)',
          opacity: glowOpacity,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
};
