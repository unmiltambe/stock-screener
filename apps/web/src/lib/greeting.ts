// Voice & tone: "Warm, personal, and a little witty — without losing the plot."
// A small dose of cordiality in the top-right corner, varied so it feels alive
// rather than templated. Time-of-day aware; addresses the user by first name when
// we know it. Keep these tasteful and market-literate — never cutesy.

type Bucket = "morning" | "afternoon" | "evening" | "night";

function bucket(hour: number): Bucket {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

// `{name}` is filled with ", <First>" when known, or "" otherwise — so each line
// reads naturally signed-in or as a guest.
const LINES: Record<Bucket, string[]> = {
  morning: [
    "Good morning{name} ☕",
    "Morning{name} — the market's awake.",
    "Rise and screen{name}.",
    "Fresh open{name}. Let's have a look.",
  ],
  afternoon: [
    "Good afternoon{name}.",
    "Back at it{name}?",
    "Good to see you{name}.",
    "Afternoon{name} — anything moving?",
  ],
  evening: [
    "Good evening{name}.",
    "Evening{name} — one more look?",
    "Winding down{name}?",
    "Welcome back{name}.",
  ],
  night: [
    "Burning the midnight oil{name}?",
    "Late one{name} — the tape never sleeps.",
    "Still up{name}?",
    "After hours{name}. Quiet's a good time to think.",
  ],
};

/** A greeting that varies per call. Pass the user's first name if known. */
export function greeting(firstName?: string | null, now: Date = new Date()): string {
  const lines = LINES[bucket(now.getHours())];
  const line = lines[Math.floor(Math.random() * lines.length)];
  const name = firstName?.trim() ? `, ${firstName.trim()}` : "";
  return line.replace("{name}", name);
}
