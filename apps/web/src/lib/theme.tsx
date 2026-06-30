import { createContext, useContext, useEffect, useState } from "react";

// Theme = light | dark | system (follows the OS / macOS appearance, and tracks
// changes live). Resolved theme is applied as a `dark` class on <html>; all the
// colour comes from the CSS tokens in index.css that flip under `.dark`.
export type ThemeMode = "light" | "dark" | "system";

const KEY = "theme";
const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

function resolve(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

// Apply synchronously on first import to avoid a flash of the wrong theme.
function applyClass(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolve(mode) === "dark");
}
const initialMode = ((typeof localStorage !== "undefined" &&
  localStorage.getItem(KEY)) as ThemeMode) || "system";
applyClass(initialMode);

type Ctx = { mode: ThemeMode; resolved: "light" | "dark"; setMode: (m: ThemeMode) => void };
const ThemeContext = createContext<Ctx>({ mode: "system", resolved: "light", setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(mode));

  useEffect(() => {
    const sync = () => { applyClass(mode); setResolved(resolve(mode)); };
    sync();
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [mode]);

  const setMode = (m: ThemeMode) => { localStorage.setItem(KEY, m); setModeState(m); };
  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
