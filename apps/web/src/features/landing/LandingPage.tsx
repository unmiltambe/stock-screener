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
import { Link } from "react-router-dom";
import { ArrowUpDown, Eye, HelpCircle, Layers, LayoutGrid, RefreshCw, Trophy, Zap } from "lucide-react";
import { useAllSymbols } from "../../api/watchlists";
import { ChartPanel } from "../watchlists/TickerTable";
import { ShowcaseScoreTable } from "./ShowcaseScoreTable";

export default function LandingPage() {
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
          <Link
            to="/watchlists"
            className="text-sm font-medium px-5 py-2.5 rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
          >
            Start free →
          </Link>
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
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-2">
          Picking stocks shouldn't need 10 browser tabs.
        </h2>
        <p className="text-dim text-base text-center mb-8">
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
        <p className="text-xs uppercase tracking-wider text-dim text-center mb-2">How it works</p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-2">
          From watchlist to decision, on one screen.
        </h2>
        <p className="text-dim text-base text-center mb-8">
          Add a ticker — or start with the ten we've loaded for you — then:
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          <HowStep n="01" label="Understand" title="See the math, not just a score"
            visual={<UnderstandVisual />}
            body="Every score breaks into visible columns. Hover any number for a plain-English explanation of what drives it." />
          <HowStep n="02" label="Visualize" title="Read the technical picture"
            visual={<VisualizeVisual />}
            body="Price with SMA-50 and SMA-200 overlays, 1W to 10Y. See the trend and where a stock sits in it." />
          <HowStep n="03" label="Act" title="Let the leaderboard rank for you"
            visual={<ActVisual />}
            body="Best ideas surfaced by strength — trends, value, second looks. Sort any column to dig deeper." />
        </div>
      </section>

      {/* ── Differentiation ── */}
      <section className="py-10 border-t border-line">
        <p className="text-xs uppercase tracking-wider text-dim text-center mb-2">Why Bellwether</p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-8">Not another data dump.</h2>
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
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-2">See it working — right now.</h2>
        <p className="text-dim text-sm text-center italic mb-6">
          Your starter list comes pre-loaded, so these views are alive on your first visit.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/watchlists/_all" className="flex items-center justify-between rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3 hover:border-accent/70 hover:bg-accent/10 transition-colors text-left">
            <div>
              <div className="font-medium">All Symbols</div>
              <div className="text-dim text-sm mt-0.5">Every ticker you track, one sortable table</div>
            </div>
            <LayoutGrid className="text-accent shrink-0" size={20} strokeWidth={1.5} />
          </Link>
          <Link to="/leaderboard" className="flex items-center justify-between rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3 hover:border-accent/70 hover:bg-accent/10 transition-colors text-left">
            <div>
              <div className="font-medium">Leaderboard</div>
              <div className="text-dim text-sm mt-0.5">Best picks first — value, momentum &amp; second looks</div>
            </div>
            <Trophy className="text-accent shrink-0" size={20} strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-12 border-t border-line text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-3">Start reading the signal.</h2>
        <p className="text-dim text-base mb-6">
          No account. No setup. Your first scored watchlist is already waiting.
        </p>
        <Link
          to="/watchlists"
          className="inline-block text-sm font-medium px-5 py-2.5 rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
        >
          Open my starter list →
        </Link>
      </section>
    </div>
  );
}

function PainCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 text-center">
      <div className="text-neg/70 flex justify-center mb-2">{icon}</div>
      <div className="font-medium text-base mb-1">{title}</div>
      <div className="text-dim text-sm leading-relaxed">{body}</div>
    </div>
  );
}

function HowStep({ n, label, title, body, visual }: { n: string; label: string; title: string; body: string; visual: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-accent mb-2">{n} · {label.toUpperCase()}</div>
      {/* Static stand-in for the captured webm loop (build task #6). */}
      <div className="h-32 mb-3">{visual}</div>
      <div className="font-medium text-base mb-1">{title}</div>
      <div className="text-dim text-sm leading-relaxed">{body}</div>
    </div>
  );
}

// ── Static "how it works" visuals ──────────────────────────────────────────────
// Crisp, theme-aware stand-ins built from the app's own tokens (no raster assets),
// standing in until the webm loops are captured (spec home-landing.md task #6).

// 01 — a mini scored table with one number "explained" by a tooltip callout.
function UnderstandVisual() {
  return (
    <div className="relative h-full rounded-lg border border-line bg-panel p-2.5 overflow-hidden">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-1 text-[8px] text-dim border-b border-line/60 pb-1">
        <span>Ticker</span>
        <span className="text-right">Fundamental</span>
        <span className="text-right">Technical</span>
        <span className="text-right">Overall</span>
      </div>
      {[
        { t: "NVDA", f: "71", tech: "84", o: "79", hl: true },
        { t: "BRK-B", f: "88", tech: "52", o: "77", hl: false },
      ].map((r) => (
        <div key={r.t} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-1 text-[10px] font-mono py-1 border-b border-line/40">
          <span className="font-medium">{r.t}</span>
          <span className={`text-right ${r.hl ? "text-accent underline decoration-dashed underline-offset-2" : "text-dim"}`}>{r.f}</span>
          <span className="text-right text-dim">{r.tech}</span>
          <span className="text-right text-dim">{r.o}</span>
        </div>
      ))}
      <div className="absolute left-6 top-[52px] bg-ink text-bg text-[8px] leading-relaxed rounded px-2 py-1 shadow-lg">
        ROE 109% · FCF 2.3%<br />PEG 1.4 · Margin 55%
      </div>
    </div>
  );
}

// 02 — a mini price chart with SMA-50 / SMA-200 overlays (theme-aware via CSS vars).
function VisualizeVisual() {
  return (
    <div className="h-full rounded-lg border border-line bg-panel p-2.5">
      <div className="flex justify-between items-center text-[8px] mb-1">
        <span className="font-medium">NVDA · 1Y</span>
        <span className="flex gap-2">
          <span className="text-accent">— Price</span>
          <span className="text-warn">-- SMA 50</span>
          <span className="text-pos">·· SMA 200</span>
        </span>
      </div>
      <svg viewBox="0 0 300 76" preserveAspectRatio="none" className="w-full" style={{ height: "76px" }}>
        <path d="M0,64 C25,60 40,58 60,52 C85,45 95,47 115,40 C140,31 150,34 170,26 C200,16 215,18 235,11 C260,6 280,4 300,2"
          fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
        <path d="M0,66 C60,63 120,54 200,40 C245,31 285,18 300,13"
          fill="none" stroke="var(--color-warn)" strokeWidth="1" strokeDasharray="5 3" />
        <path d="M0,69 C80,68 160,63 235,55 C270,50 290,46 300,44"
          fill="none" stroke="var(--color-pos)" strokeWidth="1" strokeDasharray="2 4" />
      </svg>
    </div>
  );
}

// 03 — a mini leaderboard: two labelled sections, unified accent bars.
function ActVisual() {
  const rows = [
    { label: "Riding strong trends", items: [{ t: "NVDA", s: 79 }, { t: "MSFT", s: 73 }] },
    { label: "Best value", items: [{ t: "BRK-B", s: 77 }] },
  ];
  return (
    <div className="h-full rounded-lg border border-line bg-panel p-2.5">
      {rows.map((sec) => (
        <div key={sec.label}>
          <div className="text-[8px] uppercase tracking-wider text-dim mt-1 mb-1">{sec.label}</div>
          {sec.items.map((it) => (
            <div key={it.t} className="flex items-center gap-2 py-0.5">
              <span className="font-mono text-[10px] font-medium w-10">{it.t}</span>
              <div className="flex-1 h-1 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${it.s}%` }} />
              </div>
              <span className="text-[9px] text-dim font-mono w-5 text-right">{it.s}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DiffCard({ icon, title, body, vs }: { icon: React.ReactNode; title: string; body: string; vs: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-base mb-1">{title}</div>
        <div className="text-dim text-sm leading-relaxed">{body}</div>
        <div className="text-dim text-xs mt-1.5 flex items-center gap-1">
          <span className="text-line">→</span> {vs}
        </div>
      </div>
    </div>
  );
}
