export type Colors = {
  bgTop: string; bgBot: string;
  glass: string; glassBorder: string;
  card: string; cardBorder: string;
  accent: string; accentLight: string; accentBg: string;
  red: string; redBg: string;
  text: string; textMid: string; textWhite: string; textFaint: string; textGlass: string;
  navBg: string; navBorder: string;
  isDark: boolean;
};

export const lightColors: Colors = {
  bgTop: '#EEF3FB', bgBot: '#E2EAF7',
  glass: '#FFFFFF', glassBorder: 'rgba(21,34,56,0.09)',
  card: '#FFFFFF', cardBorder: 'rgba(21,34,56,0.08)',
  accent: '#152238', accentLight: '#4A8FE8', accentBg: 'rgba(21,34,56,0.07)',
  red: '#DC2626', redBg: 'rgba(220,38,38,0.08)',
  text: '#152238', textMid: '#4A6080', textWhite: '#FFFFFF', textFaint: '#7A90AE', textGlass: '#152238',
  navBg: '#FFFFFF', navBorder: 'rgba(21,34,56,0.09)',
  isDark: false,
};

export const darkColors: Colors = {
  bgTop: '#0D1520', bgBot: '#111927',
  glass: '#1A2540', glassBorder: 'rgba(255,255,255,0.08)',
  card: '#1A2540', cardBorder: 'rgba(255,255,255,0.09)',
  accent: '#4A8FE8', accentLight: '#6AAFFF', accentBg: 'rgba(74,143,232,0.15)',
  red: '#FF6B6B', redBg: 'rgba(255,107,107,0.12)',
  text: '#E8EFF8', textMid: '#8BA3C0', textWhite: '#FFFFFF', textFaint: '#5A7A9A', textGlass: '#E8EFF8',
  navBg: '#111927', navBorder: 'rgba(255,255,255,0.08)',
  isDark: true,
};

// Static fallback for admin screens (always light)
export const C = lightColors;
