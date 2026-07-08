import { Routes, Route, Link } from 'react-router-dom'
import WatchlistsPage from './features/watchlists/WatchlistsPage'
import WatchlistDetailPage from './features/watchlists/WatchlistDetailPage'
import AllSymbolsPage from './features/watchlists/AllSymbolsPage'
import TickerDetailPage from './features/tickers/TickerDetailPage'
import { ExternalLink, MessageSquarePlus, SquareActivity } from 'lucide-react'
import AuthControls from './auth/AuthControls'
import CallbackPage from './auth/CallbackPage'
import ThemeToggle from './components/ThemeToggle'
import WelcomeNamePrompt from './auth/WelcomeNamePrompt'
import ProfilePage from './features/account/ProfilePage'
import LeaderboardPage from './features/watchlists/LeaderboardPage'
import LandingPage from './features/landing/LandingPage'
import { TermsPage, PrivacyPage } from './features/legal/LegalPages'

// Every route maps to exactly one view, independent of auth (spec home-landing.md
// D1): `/` is always the landing, `/watchlists` is always the dashboard. Auth only
// scopes WHOSE data fills a user-collection view (your watchlists) — it never
// switches which page a URL shows.
const DOCS_URL = "https://github.com/unmiltambe/stock-screener/tree/main/docs";
// Tally form ID for the feedback popup (ADR-0010); from tally.so/r/XxgZee.
const TALLY_FORM_ID = "XxgZee";

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-line px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <SquareActivity size={24} strokeWidth={1.5} className="text-accent shrink-0" />
            <span className="text-2xl font-semibold tracking-tight leading-none">bellwether</span>
          </Link>
          <Link to="/watchlists" className="text-sm text-dim hover:text-accent transition-colors">
            Watchlists
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AuthControls />
        </div>
      </header>

      <WelcomeNamePrompt />

      <main className="flex-1 min-h-0 overflow-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/watchlists" element={<WatchlistsPage />} />
          <Route path="/watchlists/_all" element={<AllSymbolsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/watchlists/:id" element={<WatchlistDetailPage />} />
          <Route path="/tickers/:symbol" element={<TickerDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
        </Routes>
      </main>

      <footer className="border-t border-line px-6 py-3 flex items-center justify-between text-xs text-dim">
        <span>Bellwether Stock Screener — read the signal, not the noise.</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-tally-open={TALLY_FORM_ID}
            data-tally-layout="modal"
            data-tally-width="540"
            className="hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <MessageSquarePlus size={12} strokeWidth={1.75} /> Report a bug / request a feature
          </button>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors inline-flex items-center gap-1"
          >
            Docs <ExternalLink size={12} strokeWidth={1.75} />
          </a>
          <Link to="/legal/privacy" className="hover:text-accent transition-colors">Privacy</Link>
          <Link to="/legal/terms" className="hover:text-accent transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
