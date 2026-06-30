// Voice & tone: "Warm, personal, and a little witty — without losing the plot."
// A dry-with-a-touch-of-sass greeting in the top-right corner, varied so it feels
// alive rather than templated. Time-of-day aware; addresses the user by first name
// when we know it; nudges toward rest after hours. No emoji (see docs/voice.md).

type Bucket = "morning" | "afternoon" | "evening" | "night";

function bucket(hour: number): Bucket {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

// `{name}` is filled with ", <First>" when known, or "" otherwise — so each line
// reads naturally either way.
const LINES: Record<Bucket, string[]> = {
  morning: [
    "Morning{name}. The market's already mispricing something.",
    "Up early{name} — so is the volatility.",
    "Morning{name}. Try not to chase the open.",
    "Look who's up{name}.",
    "Morning{name}. Coffee first, conviction second.",
    "Back at it{name}. The tape doesn't care that it's early.",
    "Morning{name}. Futures look green; stay skeptical.",
    "Early bird{name}? The good setups don't announce themselves.",
  ],
  afternoon: [
    "Afternoon{name}. Anything survive the open?",
    "Back again{name}? The watchlist noticed.",
    "Afternoon{name}. Resist the urge to refresh.",
    "Midday{name}. The chop is free; the patience isn't.",
    "Afternoon{name} — still a “long-term hold,” is it?",
    "Hey{name}. The market's busy being dramatic.",
    "Afternoon{name}. Green or red, it's just a screenshot later.",
  ],
  evening: [
    "Evening{name}. The close is in; the second-guessing begins.",
    "Evening{name}. Numbers don't sleep, but they do settle.",
    "Evening{name} — still planning to sell tomorrow?",
    "Evening{name}. The tape's done; the overthinking is optional.",
    "Done for the day{name}? The market is. Mostly.",
    "Evening{name}. Review the wins, forgive the rest.",
  ],
  night: [
    "It's late{name}. Conviction, or insomnia?",
    "After hours{name}. The good ideas are quieter — and so should you be.",
    "Late{name}. The charts will be here tomorrow. Sleep.",
    "Past trading hours{name} — permission to log off.",
    "Still up{name}? Nothing's moving. Go breathe.",
    "Late one{name}. Even the algos are resting.",
    "Midnight{name}. There's no alpha in being tired.",
    "The screens can wait{name}. Hydrate, sleep, come back sharp.",
  ],
};

let lastShown: string | null = null;

/** A greeting that varies per call (never the same line twice in a row). Pass the
 *  user's first name if known. */
export function greeting(firstName?: string | null, now: Date = new Date()): string {
  const pool = LINES[bucket(now.getHours())];
  const choices = pool.length > 1 ? pool.filter((l) => l !== lastShown) : pool;
  const line = choices[Math.floor(Math.random() * choices.length)];
  lastShown = line;
  const name = firstName?.trim() ? `, ${firstName.trim()}` : "";
  return line.replace("{name}", name);
}
