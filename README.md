# Whalyx

> **Whale Tracker** — 기관 투자자의 자금 흐름을 실시간으로 추적하는 인텔리전스 플랫폼

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)](https://railway.app/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)](https://vercel.com/)

**Live Demo**
- 🌐 Frontend: https://whalyx.vercel.app
- ⚡ Backend API: https://shimmering-smile-production-afa2.up.railway.app/docs

---

## STAR — 이 프로젝트를 왜 만들었나

### S (Situation)
워런 버핏이 어떤 종목을 팔고 있는지, 드러켄밀러가 왜 NVIDIA를 집중 매수하는지 — 일반 투자자는 이 정보를 분산된 SEC 13F 공시에서 수작업으로 찾아야 한다. 금리·주식·코인·부동산 간 자금 이동을 한눈에 파악할 수 있는 통합 플랫폼이 없었다.

### T (Task)
Claude PM / Backend Dev / Frontend Dev **3-Agent 오케스트레이션**을 직접 설계·조율하며 PM 역할 수행. 백엔드(FastAPI 서비스 레이어)·프론트(Next.js 탭 시스템) 전 과정 개발 담당.

### A (Action)
- PM-Backend-Frontend 에이전트 간 **API 인터페이스 계약 선행 설계** 후 병렬 개발
- SEC 13F 기반 **8인 전문 투자자** 포트폴리오 데이터 큐레이션 (Buffett·Wood·Burry·Dalio·Druckenmiller·Ackman·Soros·Tepper)
- `ThreadPoolExecutor` 12개 병렬 주가 조회 + 15분 인메모리 캐시 → Yahoo Finance 429 우회
- 복수 투자자 동시 매수 종목 자동 집계 알고리즘 설계
- 주식·코인·부동산·돈의흐름 **4탭** + 금리 레벨별 투자 신호 생성

### R (Result)
- 초기 로딩 시간 **80% 단축** (순차 → 12병렬)
- 복수 투자자 매수 추천 **5개 종목** 실시간 제공 (NVDA·META·MSFT·GOOGL·AMZN)
- 운영 비용 **$0/month** (Gemini 무료 티어 + CoinGecko 무료 API + yfinance)
- Claude 에이전트 오케스트레이션으로 **단일 세션** 내 기획~배포 완성

---

## 개발 방식 — Claude AI 에이전트 오케스트레이션

### 팀 구조

```
PO (사용자) — "무엇을(What)"만 지시
  └── PM (Claude) — 요구사항 분석, API 계약 정의, 결과 보고
        ├── [Backend Dev] (Claude) — FastAPI, 서비스 레이어, 병렬 조회, 캐시
        └── [Frontend Dev] (Claude) — Next.js, 컴포넌트, 탭 시스템, 스켈레톤 UI
```

### 병렬 개발 워크플로우

```
1단계 — [PM] 요구사항 파싱 → API 인터페이스 계약 정의
        └─ 엔드포인트·Request/Response 스펙을 먼저 확정

2단계 — 병렬 실행
        ├─ [Backend Dev] FastAPI 라우터 → Pydantic 모델 → 서비스 레이어
        └─ [Frontend Dev] 컴포넌트 설계 → API 연동 → 스타일링

3단계 — [PM] 통합 검증 → 인터페이스 불일치 수정 → PO 보고
```

| 항목 | 오케스트레이션 적용 결과 |
|------|------------------------|
| 개발 속도 | 기획 → 백엔드 → 프론트 → 배포까지 단일 세션 내 완성 |
| 아키텍처 일관성 | 컨텍스트 유실 없이 전체 스택 일관된 설계 유지 |
| 인터페이스 충돌 | API 계약 선행 정의로 백엔드·프론트 충돌 0건 |

---

## Features

### 주식 탭
| 기능 | 설명 |
|------|------|
| 전문 투자자 포트폴리오 | 8인 (Buffett·Wood·Burry·Dalio·Druckenmiller·Ackman·Soros·Tepper) SEC 13F 기준 |
| 매수 추천 신호 | 복수 투자자가 동시 매수 중인 종목 자동 집계 (NVDA·META·MSFT·GOOGL·AMZN) |
| 매도 주의 신호 | 복수 투자자 동시 매도 종목 경보 |
| 고래 핫 종목 | 포트폴리오 중복 보유 빈도 기반 TOP 12 |
| 종목 상세 | 30일 가격 차트 (Recharts) + AI 인사이트 (Gemini) + 최신 뉴스 |

### 코인 탭
- CoinGecko 실시간 시세 (BTC·ETH·SOL·BNB 외 10종)
- 24h·7d·30d 변동률 + 7일 스파크라인 차트

### 부동산 탭
- 서울 아파트 매매가격지수·전세가율·거래량 등 주요 지표 6개
- 한국어 부동산 최신 뉴스 (NewsAPI)

### 돈의 흐름
- 금리·주식·채권·금·BTC·부동산 30일 성과 한눈에 비교
- Fed 기준금리 레벨별 자동 투자 신호

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js 16 (Vercel)               │
│  Tabs: 주식 │ 코인 │ 부동산                           │
│  Components: InvestorCard, RecommendSection,         │
│              CryptoSection, MoneyFlowSection ...      │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────┐
│               FastAPI 0.115 (Railway)                │
│  async endpoints + ThreadPoolExecutor (12 workers)  │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │investors │ stocks   │  crypto  │  realestate  │  │
│  └────┬─────┴────┬─────┴────┬─────┴──────┬───────┘  │
│       │          │          │             │           │
│  ┌────▼──────────▼──┐  ┌────▼──┐  ┌──────▼──────┐   │
│  │ financial.py     │  │coins  │  │  news.py    │   │
│  │ yfinance +       │  │CoinG. │  │  NewsAPI    │   │
│  │ REST fallback    │  │API    │  │  KR/EN      │   │
│  │ 15min cache      │  │5min   │  │             │   │
│  └──────────────────┘  │cache  │  └─────────────┘   │
│                        └───────┘                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ ai_summary.py — Gemini 2.5 Flash               │  │
│  │ 투자자 인사이트 · 종목 분석 자동 생성            │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| 영역 | 기술 | 선택 이유 |
|------|------|-----------| 
| Backend | FastAPI + Python 3.11 | async 지원, 자동 OpenAPI 문서 |
| Frontend | Next.js 16 + TypeScript | App Router, 정적 최적화 |
| AI | Gemini 2.5 Flash | 무료 티어, 긴 컨텍스트 |
| 주가 | yfinance + Yahoo Finance REST | 무료, REST 폴백으로 IP 차단 우회 |
| 코인 | CoinGecko API v3 | 무료, sparkline 지원 |
| 뉴스 | NewsAPI | 다국어 지원 |
| 차트 | Recharts | React 네이티브, 커스텀 가능 |
| 배포 | Railway (BE) + Vercel (FE) | 무료 티어 프로덕션 지원 |

---

## Performance

| 항목 | 개선 전 | 개선 후 |
|------|---------|---------| 
| 다중 종목 주가 조회 | 순차 (0.5s × N개) | 12개 병렬 (ThreadPoolExecutor) |
| 반복 요청 | 매번 Yahoo Finance 호출 | 15분 인메모리 캐시 |
| 체감 로딩 | 흰 화면 대기 | 스켈레톤 UI (shimmer) |

---

## API Endpoints

```
GET /                        # 헬스체크
GET /investors               # 전체 투자자 목록 + 주가
GET /investors/{id}          # 투자자 상세 + 포트폴리오 + AI 인사이트
GET /stocks/hot              # 핫 종목 TOP 12
GET /stocks/recommendations  # 매수/매도 추천 신호
GET /stocks/{ticker}         # 종목 상세 + 차트 + AI 분석
GET /crypto                  # 코인 시장 + 뉴스
GET /crypto/{coin_id}        # 개별 코인 상세
GET /realestate              # 한국 부동산 지표 + 뉴스
GET /money-flow              # 자산군별 수익률 + 금리 신호
```

---

## Local Setup

```bash
# 환경 변수 설정
cp backend/.env.example backend/.env
# GEMINI_API_KEY, NEWS_API_KEY 입력

# 백엔드 실행
pip install -r backend/requirements.txt
python -m uvicorn backend.api.main:app --reload --port 8000

# 프론트엔드 실행
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

---

## Investors (SEC 13F 기준)

| 투자자 | 소속 | 스타일 | 대표 보유 |
|--------|------|--------|-----------| 
| Warren Buffett | Berkshire Hathaway | 가치투자 | AAPL · AXP · KO |
| Cathie Wood | ARK Invest | 혁신성장 | TSLA · COIN · PLTR |
| Michael Burry | Scion Asset Mgmt | 역발상 | BABA · JD · BIDU |
| Ray Dalio | Bridgewater Associates | 매크로·분산 | SPY · EEM · GLD |
| Stanley Druckenmiller | Duquesne Family Office | 기술주·매크로 | NVDA · MSFT · META |
| Bill Ackman | Pershing Square | 행동주의 | HLT · QSR · CMG |
| George Soros | Soros Fund Mgmt | 글로벌 매크로 | NVDA · META · AMZN |
| David Tepper | Appaloosa Management | 이벤트 드리븐 | META · MSFT · NVDA |
