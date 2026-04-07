"use client";

import * as React from "react";

const STORAGE_KEY = "theme";

export type ThemeSetting = "light" | "dark" | "system";

export type ThemeContextValue = {
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  /** Resolved light/dark when theme is system */
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: ThemeSetting): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function applyThemeToDocument(theme: ThemeSetting) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/**
 * Class-based theming compatible with Tailwind `darkMode: "class"`.
 * No inline `<script>` in this tree (React 19 warns on script tags in client components).
 * Initial paint is handled by `theme-init-script` in the root layout via `next/script` + `beforeInteractive`.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeSetting>("system");
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light");

  React.useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored: ThemeSetting =
        raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      setThemeState(stored);
      applyThemeToDocument(stored);
    } catch {
      applyThemeToDocument("system");
    }
    setSystemTheme(getSystemTheme());
  }, []);

  const setTheme = React.useCallback((next: ThemeSetting) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
    applyThemeToDocument(next);
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setSystemTheme(getSystemTheme());
      const raw = localStorage.getItem(STORAGE_KEY);
      const t: ThemeSetting =
        raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      if (t === "system") applyThemeToDocument("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
    }),
    [theme, setTheme, resolvedTheme, systemTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system",
      setTheme: () => {},
      resolvedTheme: "light",
      systemTheme: "light",
    };
  }
  return ctx;
}
