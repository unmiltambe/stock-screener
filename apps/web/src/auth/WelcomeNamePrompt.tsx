import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { useProfile, useUpdateProfile } from "../api/profile";

// A gentle, dismissible nudge shown right after first sign-in when we don't yet
// know the user's name — so we can greet them properly. Onboarding without a wall.
export default function WelcomeNamePrompt() {
  const auth = useAuth();
  const { data: profile } = useProfile(auth.isAuthenticated);
  const updateProfile = useUpdateProfile();
  const [first, setFirst] = useState("");
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("namePromptDismissed") === "1",
  );

  const needsName = auth.isAuthenticated && profile && !profile.first_name && !dismissed;
  if (!needsName) return null;

  function dismiss() {
    sessionStorage.setItem("namePromptDismissed", "1");
    setDismissed(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim()) return dismiss();
    updateProfile.mutate(
      { first_name: first, last_name: profile?.last_name ?? "" },
      { onSuccess: dismiss },
    );
  }

  return (
    <div className="border-b border-line bg-accent/5 px-6 py-2.5">
      <form onSubmit={save} className="max-w-5xl mx-auto flex items-center gap-3 text-sm">
        <span>👋 Welcome aboard! What should we call you?</span>
        <input
          autoFocus
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="First name"
          className="bg-bg border border-line rounded px-2.5 py-1 text-sm outline-none focus:border-accent transition-colors w-40"
        />
        <button type="submit" className="text-accent hover:underline">Save</button>
        <button type="button" onClick={dismiss} className="text-dim hover:text-ink ml-auto">
          Maybe later
        </button>
      </form>
    </div>
  );
}
