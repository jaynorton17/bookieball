import { type CSSProperties, type ReactNode, useId } from 'react';
import { motion } from 'framer-motion';
import type { PanelTone } from '../../lib/broadcastTheme';
import { PANEL_THEMES, GLASS_BACKDROP } from '../../lib/broadcastTheme';

export function SlideCanvas({ children, accent = 'gold' }: { children: ReactNode; accent?: PanelTone }) {
  const theme = PANEL_THEMES[accent];
  const id = useId();
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '30px',
        background: 'linear-gradient(180deg, #0c1930 0%, #080e1a 62%, #04060c 100%)',
        border: `1px solid ${theme.rim}22`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 70px rgba(0,0,0,0.46), 0 0 0 1px ${theme.rim}12`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'radial-gradient(circle at 50% 112%, rgba(8, 22, 38, 0.86), rgba(2, 5, 10, 0.98) 48%)',
            `radial-gradient(circle at 18% 12%, ${theme.rim}18, transparent 32%)`,
            `radial-gradient(circle at 82% 14%, ${theme.glow}, transparent 30%)`,
            'linear-gradient(180deg, rgba(10, 24, 48, 0.3), rgba(4, 8, 12, 0.8))',
          ].join(', '),
          pointerEvents: 'none',
        }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: '40%',
          aspectRatio: '1',
          background: `radial-gradient(circle, ${theme.rim}18, transparent 52%)`,
          filter: 'blur(28px)',
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.6, 0.9, 0.6], scale: [1, 1.06, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-8%',
          right: '-5%',
          width: '44%',
          aspectRatio: '1',
          background: `radial-gradient(circle, ${theme.glow}, transparent 54%)`,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.7, 0.95, 0.7], scale: [1, 1.04, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backdropFilter: GLASS_BACKDROP,
          WebkitBackdropFilter: GLASS_BACKDROP,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.9) 70%, rgba(0,0,0,0.7))',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.9) 70%, rgba(0,0,0,0.7))',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 18%, rgba(0,0,0,0.15) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '12px',
          borderRadius: '24px',
          border: `1px solid ${theme.rim}16`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px ${theme.rim}0a`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '30px',
          gap: '18px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
