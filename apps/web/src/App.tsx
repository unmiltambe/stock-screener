import { Routes, Route, Link } from 'react-router-dom'
import WatchlistsPage from './features/watchlists/WatchlistsPage'
import WatchlistDetailPage from './features/watchlists/WatchlistDetailPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-6 py-3 flex items-baseline gap-3">
        <Link to="/" className="font-semibold">Bellwether</Link>
        <span className="text-dim text-sm">stock screener</span>
      </header>
      <main className="px-6 py-6">
        <Routes>
          <Route path="/" element={<WatchlistsPage />} />
          <Route path="/watchlists/:id" element={<WatchlistDetailPage />} />
        </Routes>
      </main>
    </div>
  )
}
