import { Routes, Route, Link } from 'react-router-dom'
import WatchlistsPage from './features/watchlists/WatchlistsPage'
import WatchlistDetailPage from './features/watchlists/WatchlistDetailPage'
import AllSymbolsPage from './features/watchlists/AllSymbolsPage'
import TickerDetailPage from './features/tickers/TickerDetailPage'
import AuthControls from './auth/AuthControls'
import CallbackPage from './auth/CallbackPage'
import WelcomeNamePrompt from './auth/WelcomeNamePrompt'
import ProfilePage from './features/account/ProfilePage'
import LeaderboardPage from './features/watchlists/LeaderboardPage'

const DOCS_URL = "https://github.com/unmiltambe/stock-screener/tree/main/docs";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Link to="/" className="font-semibold">Bellwether</Link>
          <span className="text-dim text-sm">stock screener</span>
        </div>
        <AuthControls />
      </header>

      <WelcomeNamePrompt />

      <main className="flex-1 px-6 py-6">
        <Routes>
          <Route path="/" element={<WatchlistsPage />} />
          <Route path="/watchlists/_all" element={<AllSymbolsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/watchlists/:id" element={<WatchlistDetailPage />} />
          <Route path="/tickers/:symbol" element={<TickerDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/callback" element={<CallbackPage />} />
        </Routes>
      </main>

      <footer className="border-t border-line px-6 py-3 flex items-center justify-between text-xs text-dim">
        <span>Bellwether — read the signal, not the noise.</span>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent transition-colors"
        >
          Docs ↗
        </a>
      </footer>
    </div>
  )
}
