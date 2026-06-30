# Voice & tone — the UI design motto

> **Warm, personal, and a little witty — without losing the plot.**

Borrowed in spirit from Slack: a product can be cordial and human while still
sounding sharp and credible. We're a finance tool, so the bar is *market-literate
warmth* — never cutesy, never jokey at the user's expense, never noisy. A small
dose of personality in the right places makes the app feel made-by-humans without
undercutting the seriousness of the numbers.

## Principles

1. **Address the person.** Use the user's first name where it's natural (the
   top-right greeting). Default gracefully to warm-but-generic when we don't know it.
2. **Vary the small stuff.** Greetings and incidental copy rotate so the app feels
   alive, not templated. Time-of-day awareness is a cheap, genuine touch.
3. **Be brief and concrete.** Wit is a seasoning, not the meal. One clause, then
   get out of the way. If a line slows the user down, cut it.
4. **Stay literate.** Lean on market vocabulary (the tape, the open, value vs
   momentum) over emoji or exclamation. At most one emoji, rarely.
5. **Respect the moment.** Destructive or error states stay calm and plain —
   reassure, don't quip. "No hard feelings — you can start fresh as a guest" is fine;
   a joke on a failed delete is not.

## Where it shows up (today)

| Surface | Touch |
|---------|-------|
| Top-right corner | Rotating, time-aware greeting by first name (`lib/greeting.ts`) |
| First sign-in | "👋 Welcome aboard! What should we call you?" name nudge |
| Profile save | "Saved — nice to meet you." |
| Delete account | Calm, reassuring framing; no jokes |
| Leaderboard | Section blurbs ("Riding the strongest trends"), empty state invites action |
| Footer | "Bellwether — read the signal, not the noise." |
| Empty/loading states | "Pulling your lists together…", "Tallying the standings…" |

## How to add more

When you write user-facing copy, ask: *would this sound at home in a thoughtful
colleague's Slack message?* If yes — warm, clear, a touch of wit, still smart —
it fits. Keep a light hand; the numbers are the star.
