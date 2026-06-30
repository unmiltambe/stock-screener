import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "../lib/theme";

// Permanent day/night/system control. Cycles light → dark → system; the icon
// shows the current mode (Monitor = follow your Mac).
const NEXT: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };
const ICON = { light: Sun, dark: Moon, system: Monitor };
const LABEL = { light: "Light", dark: "Dark", system: "System" };

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = ICON[mode];
  return (
    <button
      onClick={() => setMode(NEXT[mode])}
      title={`Theme: ${LABEL[mode]} — click for ${LABEL[NEXT[mode]]}`}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}.`}
      className="text-dim hover:text-ink transition-colors p-1"
    >
      <Icon size={18} strokeWidth={1.75} />
    </button>
  );
}
