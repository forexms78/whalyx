# War-Investment

> 지정학 리스크(전쟁·제재·분쟁)를 실시간 분석하여 포트폴리오 위험도를 평가하는 AI 분석 시스템

[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-orange)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Live Demo**
- Frontend: https://frontend-nu-one-79.vercel.app
- Backend API: https://shimmering-smile-production-afa2.up.railway.app

---

## 개요

종목명을 입력하면 최신 지정학 뉴스와 금융 데이터를 수집하고, Gemini 2.5 Flash가 분석해 투자자용 리스크 리포트를 생성합니다.

**운영 비용: $0/month** (Gemini 2.5 Flash 무료 티어 기준)

---

## 시스템 아키텍처

```
사용자 브라우저
      ↓
Vercel (Next.js 프론트)
      ↓ POST /analyze
Railway (FastAPI 백엔드)
   ↓          ↓          ↓
NewsAPI   yfinance   Gemini 2.5 Flash
(뉴스)    (주가)      (분석 + 리포트)
```

### 분석 파이프라인

```
입력: ["NVDA", "AAPL", "TSM"]
        ↓
[1] 뉴스 수집    — NewsAPI 지정학 키워드 검색
        ↓
[2] 금융 데이터  — yfinance + Yahoo Finance REST 폴백
        ↓
[3] AI 분석      — Gemini: 이벤트 분류 + 감정 분석 + 섹터 리스크 점수
        ↓
[4] 리포트 생성  — Gemini: 투자자용 한국어 리포트 작성
        ↓
출력: 리스크 대시보드 + 경보 + 리포트
```

---

## Tech Stack

| 구분 | 기술 |
|------|------|
| LLM | Google Gemini 2.5 Flash (Free Tier) |
| Backend | Python 3.11 + FastAPI |
| Frontend | Next.js 16 + Tailwind CSS + Recharts |
| News | NewsAPI |
| Financial | yfinance + Yahoo Finance REST API (폴백) |
| Database | Supabase (PostgreSQL) |
| Deploy | Vercel (Frontend) + Railway (Backend) |

---

## Project Structure

```
war-investment/
├── backend/
│   ├── api/
│   │   └── main.py           ← FastAPI 엔드포인트 (/analyze)
│   ├── services/
│   │   ├── news.py           ← NewsAPI 지정학 뉴스 수집
│   │   ├── financial.py      ← yfinance + REST 폴백 주가 수집
│   │   ├── analyzer.py       ← Gemini 리스크 분석 + 시각화 데이터 생성
│   │   └── report.py         ← Gemini 투자자용 리포트 생성
│   ├── utils/
│   │   └── gemini.py         ← Gemini 클라이언트 (rate limit 재시도 포함)
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── app/
    │   └── page.tsx
    ├── components/
    │   ├── PortfolioInput.tsx ← 종목 입력 UI
    │   ├── Dashboard.tsx      ← 분석 결과 대시보드
    │   ├── RiskChart.tsx      ← 종목/섹터별 리스크 차트 (Recharts)
    │   ├── AlertBanner.tsx    ← 위험 경보 배너
    │   ├── StockRiskTable.tsx ← 종목별 상세 리스크 테이블
    │   └── ReportSection.tsx  ← AI 리포트 렌더링
    └── types/
        └── index.ts
```

---

## Getting Started (로컬 실행)

```bash
# 1. 레포 클론
git clone https://github.com/forexms78/war-investment.git
cd war-investment

# 2. 백엔드 의존성 설치
pip install -r backend/requirements.txt

# 3. 환경변수 설정
cp backend/.env.example backend/.env
# .env에 API 키 입력

# 4. 백엔드 실행
python -m uvicorn backend.api.main:app --reload --port 8000

# 5. 프론트엔드 실행 (새 터미널)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## Environment Variables

```bash
# backend/.env
GEMINI_API_KEY=     # aistudio.google.com에서 발급
NEWS_API_KEY=       # newsapi.org에서 발급
SUPABASE_URL=       # Supabase 프로젝트 URL
SUPABASE_KEY=       # Supabase anon key

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### MOCK_MODE (API 키 없이 테스트)

```bash
MOCK_MODE=true python -m uvicorn backend.api.main:app --reload
```

---

## 배포

### Backend — Railway

```bash
railway login
railway up
```

`railway.json`과 `Dockerfile`이 이미 구성되어 있습니다.

Railway 대시보드에서 환경변수 설정 필요:
- `GEMINI_API_KEY`
- `NEWS_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

### Frontend — Vercel

```bash
cd frontend
vercel env add NEXT_PUBLIC_API_URL production  # Railway URL 입력
vercel --prod
```

---

## Supabase 테이블 설정

```sql
CREATE TABLE IF NOT EXISTS analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  portfolio text[],
  report text,
  overall_risk_level text,
  visualization_data jsonb
);
```

---

## 기술적 해결 사항

| 문제 | 원인 | 해결 |
|------|------|------|
| Yahoo Finance 데이터 수집 실패 | 한국 IP 차단 | User-Agent 헤더 + Yahoo Finance REST API 직접 호출 폴백 |
| Gemini API 429 오류 | 무료 티어 분당 요청 한도 | 자동 재시도 로직 (최대 3회, retry-after 파싱) |
| Gemini 2.0 Flash quota 0 | AI Studio 외 경로 발급 키 제한 | Gemini 2.5 Flash로 전환 |

---

## License

MIT
