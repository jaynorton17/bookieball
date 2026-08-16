export type PanelTone = 'gold' | 'steel' | 'blue' | 'red' | 'onyx';

export type TeamPalette = {
  ballColor: string;
  ringColor: string;
  textColor: string;
};

export const DEFAULT_TEAM_PALETTE: TeamPalette = {
  ballColor: '#d6e9ff',
  ringColor: '#91c7ff',
  textColor: '#0f1b2d',
};

export type GlassTheme = {
  rim: string;
  glow: string;
  header: string;
  body: string;
  text: string;
  panelGlow: string;
  glassBg: string;
  glassBorder: string;
  accent: string;
};

export const PANEL_THEMES: Record<PanelTone, GlassTheme> = {
  gold: {
    rim: '#e7c56f',
    glow: 'rgba(255, 223, 128, 0.22)',
    header: 'linear-gradient(180deg, #f2db8d 0%, #c89b32 52%, #6a4b18 100%)',
    body: 'linear-gradient(180deg, rgba(18, 26, 42, 0.96), rgba(6, 10, 18, 0.98))',
    text: '#fff5d0',
    panelGlow: 'rgba(255, 219, 119, 0.18)',
    glassBg: 'rgba(18, 26, 42, 0.72)',
    glassBorder: 'rgba(231, 197, 111, 0.2)',
    accent: '#f5d38f',
  },
  steel: {
    rim: '#cbd4e7',
    glow: 'rgba(210, 222, 243, 0.18)',
    header: 'linear-gradient(180deg, #eef2f7 0%, #afb9cd 46%, #59667e 100%)',
    body: 'linear-gradient(180deg, rgba(20, 28, 42, 0.96), rgba(6, 10, 16, 0.98))',
    text: '#f8fbff',
    panelGlow: 'rgba(217, 228, 244, 0.14)',
    glassBg: 'rgba(20, 28, 42, 0.72)',
    glassBorder: 'rgba(203, 212, 231, 0.18)',
    accent: '#cbd4e7',
  },
  blue: {
    rim: '#90bbff',
    glow: 'rgba(125, 177, 255, 0.2)',
    header: 'linear-gradient(180deg, #64a6ff 0%, #285fbd 52%, #11326e 100%)',
    body: 'linear-gradient(180deg, rgba(14, 28, 55, 0.96), rgba(6, 10, 18, 0.98))',
    text: '#f0f7ff',
    panelGlow: 'rgba(107, 165, 255, 0.18)',
    glassBg: 'rgba(14, 28, 55, 0.72)',
    glassBorder: 'rgba(144, 187, 255, 0.18)',
    accent: '#90bbff',
  },
  red: {
    rim: '#ff9d96',
    glow: 'rgba(255, 120, 110, 0.18)',
    header: 'linear-gradient(180deg, #ef7369 0%, #b42624 52%, #5a1016 100%)',
    body: 'linear-gradient(180deg, rgba(45, 16, 22, 0.96), rgba(14, 6, 8, 0.98))',
    text: '#fff0ea',
    panelGlow: 'rgba(255, 109, 96, 0.16)',
    glassBg: 'rgba(45, 16, 22, 0.72)',
    glassBorder: 'rgba(255, 157, 150, 0.18)',
    accent: '#ff9d96',
  },
  onyx: {
    rim: '#d6bf7e',
    glow: 'rgba(214, 191, 126, 0.15)',
    header: 'linear-gradient(180deg, #3a3f4d 0%, #151922 52%, #05070b 100%)',
    body: 'linear-gradient(180deg, rgba(18, 20, 26, 0.96), rgba(5, 6, 10, 0.98))',
    text: '#f5e3a7',
    panelGlow: 'rgba(214, 191, 126, 0.14)',
    glassBg: 'rgba(18, 20, 26, 0.72)',
    glassBorder: 'rgba(214, 191, 126, 0.16)',
    accent: '#d6bf7e',
  },
};

export const GLASS_BACKDROP = 'blur(14px)';
export const GLASS_BACKDROP_HEAVY = 'blur(22px)';

export const slideTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
} as const;
