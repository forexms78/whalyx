export type Lang = "ko" | "en";

export const LANGS: Lang[] = ["ko", "en"];

export const DICT: Record<Lang, Record<string, string>> = {
  ko: {
    "tab.signal":     "Whale Signal",
    "tab.markets":    "마켓",
    "tab.etfstocks":  "ETF·주식",
    "tab.quant":      "Quant",
    "live":           "LIVE",
    "lang.ko":        "KO",
    "lang.en":        "EN",
    "theme.dark":     "DARK",
    "theme.light":    "LIGHT",

    "hero.label":       "Whalyx Top 8 · 30일 평균 수익률",
    "hero.description": "13F 공시 기반 슈퍼투자자 8인 포트폴리오 평균",
    "hero.cta":         "시그널 받기",

    "pilots.title":     "슈퍼투자자 8인",
    "pilots.subtitle":  "13F 공시 기반 — 카드 클릭 시 포트폴리오 공개",

    "topperf.title":    "Top Performers",
    "topperf.subtitle": "13F 보유 종목 중 최근 30일 수익률 상위",

    "etf.title":            "매수·매도 타이밍 시그널",
    "etf.subtitle":         "RSI · 52주 위치 · 이동평균 · AI 종합 판정",
    "etf.description":      "기술 지표 5종 + Gemini 2.5 Flash 종합 분석. 30분마다 갱신.",
    "etf.updated":          "갱신",
    "etf.empty":            "시그널 데이터를 준비 중입니다. 잠시 후 새로고침해 주세요.",
    "etf.group.etfs":       "ETF · 배당",
    "etf.group.etfs.sub":   "미장 인덱스 · SCHD · 한국 커버드콜 17종",
    "etf.group.us":         "미국 주식",
    "etf.group.us.sub":     "AAPL · NVDA · TSLA 등 12종",
    "etf.group.kr":         "한국 주식",
    "etf.group.kr.sub":     "삼성전자 · 하이닉스 등 12종",

    "signal.STRONG_BUY":  "강력 매수",
    "signal.BUY":         "매수",
    "signal.HOLD":        "관망",
    "signal.SELL":        "매도",
    "signal.STRONG_SELL": "강력 매도",

    "phase.MARKUP":   "상승",
    "phase.SIDEWAYS": "횡보",
    "phase.MARKDOWN": "하락",

    "danger.label": "DANGER · 과열 구간 신규 진입 주의",
  },
  en: {
    "tab.signal":     "Whale Signal",
    "tab.markets":    "Markets",
    "tab.etfstocks":  "ETF · Stocks",
    "tab.quant":      "Quant",
    "live":           "LIVE",
    "lang.ko":        "KO",
    "lang.en":        "EN",
    "theme.dark":     "DARK",
    "theme.light":    "LIGHT",

    "hero.label":       "Whalyx Top 8 · 30-Day Avg Return",
    "hero.description": "13F super-investor 8-portfolio average",
    "hero.cta":         "Get Signals",

    "pilots.title":     "Super Investors",
    "pilots.subtitle":  "Based on 13F filings — click for portfolio detail",

    "topperf.title":    "Top Performers",
    "topperf.subtitle": "Top 30-day returns from 13F holdings",

    "etf.title":            "Buy / Sell Timing Signals",
    "etf.subtitle":         "RSI · 52w position · Moving avgs · AI judgment",
    "etf.description":      "5 technical indicators + Gemini 2.5 Flash analysis. Refresh every 30min.",
    "etf.updated":          "Updated",
    "etf.empty":            "Signals are being prepared. Please refresh shortly.",
    "etf.group.etfs":       "ETF · Dividend",
    "etf.group.etfs.sub":   "US index · SCHD · 17 Korean covered-call ETFs",
    "etf.group.us":         "US Stocks",
    "etf.group.us.sub":     "AAPL · NVDA · TSLA + 12 names",
    "etf.group.kr":         "KR Stocks",
    "etf.group.kr.sub":     "Samsung · Hynix + 12 names",

    "signal.STRONG_BUY":  "STRONG BUY",
    "signal.BUY":         "BUY",
    "signal.HOLD":        "HOLD",
    "signal.SELL":        "SELL",
    "signal.STRONG_SELL": "STRONG SELL",

    "phase.MARKUP":   "Markup",
    "phase.SIDEWAYS": "Sideways",
    "phase.MARKDOWN": "Markdown",

    "danger.label": "DANGER · Overheated zone, caution on entry",
  },
};
