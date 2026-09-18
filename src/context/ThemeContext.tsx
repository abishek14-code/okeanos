import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'obsidian';
export type AccentColor = 'ice' | 'blue' | 'emerald' | 'amber' | 'white';
export type UiDensity = 'compact' | 'standard' | 'spacious';
export type MotionMode = 'snappy' | 'reduced';

interface ThemeContextType {
  theme: ThemeMode;
  accent: AccentColor;
  density: UiDensity;
  motion: MotionMode;
  isThemeModalOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setDensity: (density: UiDensity) => void;
  setMotion: (motion: MotionMode) => void;
  toggleThemeModal: () => void;
  openThemeModal: () => void;
  closeThemeModal: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme] = useState<ThemeMode>('obsidian');

  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem('okeanos_accent') as AccentColor) || 'ice';
  });

  const [density, setDensityState] = useState<UiDensity>(() => {
    return (localStorage.getItem('okeanos_density') as UiDensity) || 'standard';
  });

  const [motion, setMotionState] = useState<MotionMode>(() => {
    return (localStorage.getItem('okeanos_motion') as MotionMode) || 'snappy';
  });

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Sync to HTML Document Attributes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-density', density);
    root.setAttribute('data-motion', motion);

    localStorage.setItem('okeanos_theme', theme);
    localStorage.setItem('okeanos_accent', accent);
    localStorage.setItem('okeanos_density', density);
    localStorage.setItem('okeanos_motion', motion);
  }, [theme, accent, density, motion]);



  const setTheme = (_t?: ThemeMode) => {};
  const setAccent = (a: AccentColor) => setAccentState(a);
  const setDensity = (d: UiDensity) => setDensityState(d);
  const setMotion = (m: MotionMode) => setMotionState(m);
  const toggleThemeModal = () => setIsThemeModalOpen((prev) => !prev);
  const openThemeModal = () => setIsThemeModalOpen(true);
  const closeThemeModal = () => setIsThemeModalOpen(false);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accent,
        density,
        motion,
        isThemeModalOpen,
        setTheme,
        setAccent,
        setDensity,
        setMotion,
        toggleThemeModal,
        openThemeModal,
        closeThemeModal,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
