import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "tm_theme";

function getStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* abaikan */
  }
  return "system";
}

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "system") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  }
  return t;
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(t) === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStored);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* abaikan */
    }
    setThemeState(t);
    applyTheme(t);
    window.dispatchEvent(new CustomEvent("tm:theme:updated"));
  }, []);

  const toggle = useCallback(() => {
    const current = getStored();
    setTheme(resolveTheme(current) === "dark" ? "light" : "dark");
  }, [setTheme]);

  useEffect(() => {
    applyTheme(theme);
    const sync = () => {
      const next = getStored();
      setThemeState(next);
      applyTheme(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    let mq: MediaQueryList | null = null;
    const onMq = () => applyTheme(getStored());
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onMq);
    } catch {
      /* abaikan */
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("tm:theme:updated", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tm:theme:updated", sync);
      try {
        mq?.removeEventListener("change", onMq);
      } catch {
        /* abaikan */
      }
    };
  }, [theme]);

  return { theme, setTheme, toggle, isDark: resolveTheme(theme) === "dark" };
}
