"""Pure symbol search/ranking (ADR-0011)."""
from core.models import SymbolInfo
from core.symbols import search_symbols

U = [
    SymbolInfo("AAPL", "Apple Inc.", "NASDAQ", "US"),
    SymbolInfo("APP", "AppLovin Corporation", "NASDAQ", "US"),
    SymbolInfo("APPF", "AppFolio, Inc.", "NASDAQ", "US"),
    SymbolInfo("MSFT", "Microsoft Corporation", "NASDAQ", "US"),
    SymbolInfo("SPY", "SPDR S&P 500 ETF Trust", "NYSE Arca", "US"),
]


def test_exact_symbol_ranks_first():
    r = search_symbols(U, "app")
    assert r[0].symbol == "APP"                 # exact beats prefix/name


def test_prefix_before_name_hits():
    r = [s.symbol for s in search_symbols(U, "app")]
    # exact APP, then prefix APPF, then name hit AAPL ("Apple")
    assert r[0] == "APP" and r[1] == "APPF"
    assert "AAPL" in r and r.index("APPF") < r.index("AAPL")


def test_name_substring_match():
    assert [s.symbol for s in search_symbols(U, "microsoft")] == ["MSFT"]


def test_case_insensitive():
    assert search_symbols(U, "aApL")[0].symbol == "AAPL"


def test_empty_query_returns_nothing():
    assert search_symbols(U, "") == []
    assert search_symbols(U, "   ") == []


def test_limit_respected():
    assert len(search_symbols(U, "a", limit=2)) == 2
