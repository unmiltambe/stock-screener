import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthToken } from "../../api/client";
import { useProfile, useUpdateProfile, useDeleteAccount } from "../../api/profile";

export default function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile(auth.isAuthenticated);
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirst(profile.first_name);
      setLast(profile.last_name);
    }
  }, [profile]);

  if (!auth.isAuthenticated) {
    return (
      <div className="max-w-md mx-auto text-center mt-16">
        <h1 className="text-lg font-semibold mb-2">Your profile lives behind sign-in</h1>
        <p className="text-dim text-sm mb-5">
          Sign in to set your name and manage your account. As a guest, your
          watchlists stay with this browser — sign in any time to keep them for good.
        </p>
        <button
          onClick={() => void auth.signinRedirect()}
          className="text-sm px-4 py-2 rounded bg-accent text-bg font-medium"
        >
          Sign in
        </button>
      </div>
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(
      { first_name: first, last_name: last },
      { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); } },
    );
  }

  function removeAccount() {
    const ok = window.confirm(
      "Delete your account?\n\nThis permanently removes your watchlists and sign-in. " +
      "This can't be undone.",
    );
    if (!ok) return;
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setAuthToken(null);
        void auth.removeUser();
        qc.clear();
        navigate("/", { replace: true });
      },
    });
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="text-accent text-sm hover:underline">← Back</Link>
      <h1 className="text-lg font-semibold mt-2 mb-1">Your profile</h1>
      <p className="text-dim text-sm mb-6">
        Tell us what to call you — we'll keep it friendly.
      </p>

      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-dim">First name</span>
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Ada"
              className="mt-1 w-full bg-bg border border-line rounded px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-dim">Last name</span>
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Lovelace"
              className="mt-1 w-full bg-bg border border-line rounded px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="text-sm px-4 py-2 rounded bg-accent text-bg font-medium disabled:opacity-40"
          >
            {updateProfile.isPending ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-pos text-sm">Saved — nice to meet you.</span>}
        </div>
      </form>

      <div className="mt-12 border border-neg/30 rounded-lg p-4 bg-neg/5">
        <h2 className="font-medium text-sm">Delete account</h2>
        <p className="text-dim text-sm mt-1 mb-3">
          Removes your watchlists and sign-in for good. No hard feelings — you can
          always start fresh as a guest.
        </p>
        <button
          onClick={removeAccount}
          disabled={deleteAccount.isPending}
          className="text-sm px-3 py-1.5 rounded border border-neg/50 text-neg hover:bg-neg/10 transition-colors disabled:opacity-40"
        >
          {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </div>
  );
}
