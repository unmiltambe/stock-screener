"""Parsing/filtering of the NASDAQ Trader directory (ADR-0011)."""
from adapters.symbol_universe import normalize_symbol, parse_nasdaq_traded

SAMPLE = """Nasdaq Traded|Symbol|Security Name|Listing Exchange|Market Category|ETF|Round Lot Size|Test Issue|Financial Status|CQS Symbol|NASDAQ Symbol|NextShares
Y|AAPL|Apple Inc. Common Stock|Q|Q|N|100|N|N|AAPL|AAPL|N
Y|SPY|SPDR S&P 500 ETF Trust|P|P|Y|100|N||SPY|SPY|N
Y|BRK.B|Berkshire Hathaway Inc. Class B|N| |N|100|N||BRK.B|BRK.B|N
Y|PFBC|Preferred Bank Common Stock|Q|Q|N|100|N|N|PFBC|PFBC|N
Y|BABA|Alibaba Group Holding Limited American Depositary Shares|N| |N|100|N||BABA|BABA|N
Y|XYZW|Some Company Warrant|N| |N|100|N||XYZW|XYZW|N
Y|XYZU|Some Company Units|N| |N|100|N||XYZU|XYZU|N
Y|XYZP|Some Company 6.5% Preferred Stock|N| |N|100|N||XYZP|XYZP|N
Y|ZZZT|NASDAQ TEST STOCK|Q|Q|N|100|Y|N|ZZZT|ZZZT|N
N|NOPE|Not Nasdaq Traded Common Stock|N| |N|100|N||NOPE|NOPE|N
File Creation Time: 0702202621:33|||||"""


def _symbols():
    return {s.symbol: s for s in parse_nasdaq_traded(SAMPLE)}


def test_common_stock_and_etf_kept():
    s = _symbols()
    assert s["AAPL"].exchange == "NASDAQ"
    assert s["SPY"].exchange == "NYSE Arca"       # ETF kept
    assert s["AAPL"].market == "US"


def test_class_share_normalized_to_yahoo_form():
    s = _symbols()
    assert "BRK-B" in s and "BRK.B" not in s      # dot → hyphen


def test_common_stock_named_preferred_bank_kept():
    assert "PFBC" in _symbols()                    # "Preferred Bank" is common — not a preferred


def test_adr_kept():
    assert "BABA" in _symbols()                    # American Depositary Shares = common equity


def test_non_common_dropped():
    s = _symbols()
    for junk in ("XYZW", "XYZU", "XYZP"):          # warrant, units, preferred
        assert junk not in s


def test_test_issue_and_non_traded_dropped():
    s = _symbols()
    assert "ZZZT" not in s                          # Test Issue = Y
    assert "NOPE" not in s                          # Nasdaq Traded = N


def test_footer_not_parsed_as_symbol():
    assert not any("FILE" in sym for sym in _symbols())


def test_normalize_symbol():
    assert normalize_symbol("BRK.B") == "BRK-B"
    assert normalize_symbol("brk/a") == "BRK-A"
