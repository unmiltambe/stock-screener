import { useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
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

const ENTERED_KEY = 'enteredApp'

// Signed-out first-time visitors see the marketing landing; signed-in users and
// guests who've clicked "Start free" get the dashboard (spec: home-landing.md D1).
// The "entered" flag is session-scoped, mirroring the guestId semantics — a fresh
// tab lands on the pitch again.
function Home() {
  const auth = useAuth()
  const [entered, setEntered] = useState(() => !!sessionStorage.getItem(ENTERED_KEY))
  if (auth.isLoading) return <p className="text-dim">Loading…</p>
  if (auth.isAuthenticated || entered) return <WatchlistsPage />
  return <LandingPage onStart={() => { sessionStorage.setItem(ENTERED_KEY, '1'); setEntered(true) }} />
}

const DOCS_URL = "https://github.com/unmiltambe/stock-screener/tree/main/docs";
// Tally form ID for the feedback popup (ADR-0010); from tally.so/r/XxgZee.
const TALLY_FORM_ID = "XxgZee";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <SquareActivity size={24} strokeWidth={1.5} className="text-accent shrink-0" />
          <span className="text-2xl font-semibold tracking-tight leading-none">bellwether</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <AuthControls />
        </div>
      </header>

      <WelcomeNamePrompt />

      <main className="flex-1 px-6 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watchlists/_all" element={<AllSymbolsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/watchlists/:id" element={<WatchlistDetailPage />} />
          <Route path="/tickers/:symbol" element={<TickerDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/callback" element={<CallbackPage />} />
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
        </div>
      </footer>
    </div>
  )
}
