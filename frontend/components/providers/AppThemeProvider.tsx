"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  updateAccountPreferences,
  type AccentColor,
  type ThemeMode,
} from "@/lib/api/services/authApi";

interface AppThemeContextValue {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  saving: boolean;
  setThemeMode: (value: ThemeMode) => Promise<void>;
  setAccentColor: (value: AccentColor) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);
const STORAGE_KEY = "study-workspace-theme";

function readDemoPreferences() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as {
      themeMode?: ThemeMode;
      accentColor?: AccentColor;
    } | null;
  } catch {
    return null;
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { mode, user, setUser } = useAuth();
  const demoPreferences = mode === "demo" ? readDemoPreferences() : null;
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    user?.themeMode ?? demoPreferences?.themeMode ?? "LIGHT",
  );
  const [accentColor, setAccentColorState] = useState<AccentColor>(
    user?.accentColor ?? demoPreferences?.accentColor ?? "PURPLE",
  );
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (nextTheme: ThemeMode, nextAccent: AccentColor) => {
    const previousTheme = themeMode;
    const previousAccent = accentColor;
    setThemeModeState(nextTheme);
    setAccentColorState(nextAccent);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: nextTheme, accentColor: nextAccent }));
    if (mode === "demo") return;

    setSaving(true);
    try {
      const updated = await updateAccountPreferences({ themeMode: nextTheme, accentColor: nextAccent });
      setUser(updated);
    } catch (error) {
      setThemeModeState(previousTheme);
      setAccentColorState(previousAccent);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: previousTheme, accentColor: previousAccent }));
      throw error;
    } finally {
      setSaving(false);
    }
  }, [accentColor, mode, setUser, themeMode]);

  const value = useMemo<AppThemeContextValue>(() => ({
    themeMode,
    accentColor,
    saving,
    setThemeMode: (value) => save(value, accentColor),
    setAccentColor: (value) => save(themeMode, value),
  }), [accentColor, save, saving, themeMode]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error("useAppTheme must be used inside AppThemeProvider");
  return context;
}
