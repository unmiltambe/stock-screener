// Marketing landing for signed-out visitors (spec: docs/specs/home-landing.md).
// Narrative arc: audience → pain → how it works → differentiation → live proof → CTA.
// The hero embeds the REAL ChartPanel + a compact ShowcaseScoreTable fed by live
// data (the guest's seeded starter list) — so it demonstrates the actual product,
// not a screenshot that goes stale (D2). Signed-in users get the dashboard instead;
// the gate lives in App.tsx.
//
// NOTE: the three "how it works" panels are placeholders for the captured webm loops
// (build task #6). Sections are kept local for now; split into the spec's file layout
// if they grow.

import { useMemo, useState } from "react";
import { ArrowUpDown, Eye, HelpCircle, Layers, LayoutGrid, RefreshCw, Trophy, Zap } from "lucide-react";
import { useAllSymbols } from "../../api/watchlists";
import { ChartPanel } from "../watchlists/TickerTable";
import { ShowcaseScoreTable } from "./ShowcaseScoreTable";

export default function LandingPage({ onStart }: { onStart: () => void }) {
  const { data: rows, isLoading } = useAllSymbols();
  const showcase = useMemo(() => rows.slice(0, 6), [rows]);
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected ?? showcase[0]?.ticker ?? null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Hero ── */}
      <section className="pt-6 pb-10">
        <p className="text-xs uppercase tracking-wider text-accent font-medium mb-2">
          For the self-directed investor
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight mb-3">
          Read the signal, not the noise.
        </h1>
        <p className="text-dim text-base leading-relaxed max-w-xl mb-4">
          Score every stock you follow — fundamentals, technicals, momentum — in one
          screen. Know what's worth watching, and why.
        </p>
        <div className="flex items-center gap-4 text-sm text-dim mb-6">
          <span><strong className="text-ink font-medium">11k+</strong> US symbols</span>
          <span className="text-line">·</span>
          <span><strong className="text-ink font-medium">Scored</strong> automatically</span>
          <span className="text-line">·</span>
          <span><strong className="text-ink font-medium">No login</strong> needed</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onStart}
            className="text-sm font-medium px-5 py-2.5 rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
          >
            Start free →
          </button>
          <span className="text-xs text-dim">no account, 30 seconds</span>
        </div>

        {/* Live product panel — real ChartPanel + compact scored table */}
        <div className="mt-8 rounded-xl border border-line bg-panel overflow-hidden">
          {isLoading ? (
            <p className="text-dim text-sm p-8 text-center">Warming up the tape…</p>
          ) : active ? (
            <>
              <ChartPanel ticker={active} onClose={() => {}} hideClose />
              <ShowcaseScoreTable
                rows={showcase}
                selectedTicker={active}
                onSelect={setSelected}
              />
              <p className="text-[11px] text-dim text-center py-2 border-t border-line/50">
                Live scores from a starter watchlist — pick a row to chart it.
              </p>
            </>
          ) : (
            <p className="text-dim text-sm p-8 text-center">
              Your starter watchlist is on its way.
            </p>
          )}
        </div>
      </section>

      {/* ── Pain ── */}
      <section className="py-10 border-t border-line">
        <h2 className="text-xl font-semibold text-center mb-1">
          Picking stocks shouldn't need 10 browser tabs.
        </h2>
        <p className="text-dim text-sm text-center mb-8">
          If any of this sounds familiar, you're the reason we built Bellwether.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PainCard icon={<LayoutGrid size={20} strokeWidth={1.5} />} title="Scattered tools"
            body="Fundamentals on one site, charts on another, a spreadsheet to tie it together." />
          <PainCard icon={<HelpCircle size={20} strokeWidth={1.5} />} title="Numbers without meaning"
            body="A 22× P/E and RSI of 68 — but is that good here? No context." />
          <PainCard icon={<ArrowUpDown size={20} strokeWidth={1.5} />} title="Manual comparison"
            body="Eyeballing 20 tickers to find the one that stands out. Every time." />
          <PainCard icon={<RefreshCw size={20} strokeWidth={1.5} />} title="Always stale"
            body="Prices and signals move; your research is out of date by next week." />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-10 border-t border-line">
        <p className="text-[10px] uppercase tracking-wider text-dim text-center mb-1">How it works</p>
        <h2 className="text-xl font-semibold text-center mb-1">
          From watchlist to decision, on one screen.
        </h2>
        <p className="text-dim text-sm text-center mb-8">
          Add a ticker — or start with the ten we've loaded for you — then:
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          <HowStep n="01" label="Understand" title="See the math, not just a score"
            body="Every score breaks into visible columns. Hover any number for a plain-English explanation of what drives it." />
          <HowStep n="02" label="Visualize" title="Read the technical picture"
            body="Price with SMA-50 and SMA-200 overlays, 1W to 10Y. See the trend and where a stock sits in it." />
          <HowStep n="03" label="Act" title="Let the leaderboard rank for you"
            body="Best ideas surfaced by strength — trends, value, second looks. Sort any column to dig deeper." />
        </div>
      </section>

      {/* ── Differentiation ── */}
      <section className="py-10 border-t border-line">
        <p className="text-[10px] uppercase tracking-wider text-dim text-center mb-1">Why Bellwether</p>
        <h2 className="text-xl font-semibold text-center mb-8">Not another data dump.</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <DiffCard icon={<Eye size={18} strokeWidth={1.5} />} title="Transparent scoring"
            body="See exactly how each score is built — every metric visible, every column explained."
            vs="instead of opaque star ratings" />
          <DiffCard icon={<Layers size={18} strokeWidth={1.5} />} title="Fundamentals + technicals, together"
            body="One combined score blends value and momentum — the two lenses most tools split apart."
            vs="instead of one lens at a time" />
          <DiffCard icon={<Trophy size={18} strokeWidth={1.5} />} title="Opportunities ranked for you"
            body="The leaderboard does the scanning — best value, strongest trend, worth a second look."
            vs="instead of flat alphabetical lists" />
          <DiffCard icon={<Zap size={18} strokeWidth={1.5} />} title="Zero friction to try"
            body="In as a guest instantly — no signup wall. Sign in later only if you want lists saved."
            vs="instead of account-gated demos" />
        </div>
      </section>

      {/* ── Live proof ── */}
      <section className="py-10 border-t border-line">
        <h2 className="text-lg font-semibold text-center mb-1">See it working — right now.</h2>
        <p className="text-dim text-xs text-center italic mb-6">
          Your starter list comes pre-loaded, so these views are alive on your first visit.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={onStart} className="flex items-center justify-between rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3 hover:border-accent/70 hover:bg-accent/10 transition-colors text-left">
            <div>
              <div className="font-medium">All Symbols</div>
              <div className="text-dim text-sm mt-0.5">Every ticker you track, one sortable table</div>
            </div>
            <LayoutGrid className="text-accent shrink-0" size={20} strokeWidth={1.5} />
          </button>
          <button onClick={onStart} className="flex items-center justify-between rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3 hover:border-accent/70 hover:bg-accent/10 transition-colors text-left">
            <div>
              <div className="font-medium">Leaderboard</div>
              <div className="text-dim text-sm mt-0.5">Best picks first — value, momentum &amp; second looks</div>
            </div>
            <Trophy className="text-accent shrink-0" size={20} strokeWidth={1.5} />
          </button>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-12 border-t border-line text-center">
        <h2 className="text-2xl font-semibold mb-2">Start reading the signal.</h2>
        <p className="text-dim text-sm mb-6">
          No account. No setup. Your first scored watchlist is already waiting.
        </p>
        <button
          onClick={onStart}
          className="text-sm font-medium px-5 py-2.5 rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
        >
          Open my starter list →
        </button>
      </section>
    </div>
  );
}

function PainCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 text-center">
      <div className="text-neg/70 flex justify-center mb-2">{icon}</div>
      <div className="font-medium text-sm mb-1">{title}</div>
      <div className="text-dim text-xs leading-relaxed">{body}</div>
    </div>
  );
}

function HowStep({ n, label, title, body }: { n: string; label: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-accent mb-2">{n} · {label.toUpperCase()}</div>
      {/* Placeholder for the captured webm loop (build task #6). */}
      <div className="rounded-lg border border-line bg-bg h-28 mb-3 flex items-center justify-center text-dim text-[11px]">
        {label} — demo loop
      </div>
      <div className="font-medium text-sm mb-1">{title}</div>
      <div className="text-dim text-xs leading-relaxed">{body}</div>
    </div>
  );
}

function DiffCard({ icon, title, body, vs }: { icon: React.ReactNode; title: string; body: string; vs: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-sm mb-1">{title}</div>
        <div className="text-dim text-xs leading-relaxed">{body}</div>
        <div className="text-dim text-[11px] mt-1.5 flex items-center gap-1">
          <span className="text-line">→</span> {vs}
        </div>
      </div>
    </div>
  );
}
