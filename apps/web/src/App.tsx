import { Routes, Route, Link } from 'react-router-dom'
import WatchlistsPage from './features/watchlists/WatchlistsPage'
import WatchlistDetailPage from './features/watchlists/WatchlistDetailPage'
import AllSymbolsPage from './features/watchlists/AllSymbolsPage'
import TickerDetailPage from './features/tickers/TickerDetailPage'

const DOCS_URL = "https://github.com/unmiltambe/stock-screener/tree/main/docs";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 py-3 flex items-baseline gap-3">
        <Link to="/" className="font-semibold">Bellwether</Link>
        <span className="text-dim text-sm">stock screener</span>
      </header>

      <main className="flex-1 px-6 py-6">
        <Routes>
          <Route path="/" element={<WatchlistsPage />} />
          <Route path="/watchlists/_all" element={<AllSymbolsPage />} />
          <Route path="/watchlists/:id" element={<WatchlistDetailPage />} />
          <Route path="/tickers/:symbol" element={<TickerDetailPage />} />
        </Routes>
      </main>

      <footer className="border-t border-line px-6 py-3 flex items-center justify-between text-xs text-dim">
        <span>Bellwether — stock screener</span>
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
