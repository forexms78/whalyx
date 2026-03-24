# War-Investment Agent

> 지정학 리스크(전쟁·제재·분쟁)를 실시간 분석하여 포트폴리오 위험도를 평가하는 **OMS 16-Agent 오케스트레이션 시스템**

[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-green)](https://langchain-ai.github.io/langgraph/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-orange)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 개요

실제 대형 개발 조직 구조(PM / TPM / Supervisor / MSA)를 AI 에이전트로 모델링하여,
사용자는 종목만 입력하면 16개 에이전트가 자율 협업으로 지정학 리스크 리포트를 생성합니다.

**총 운영 비용: $0/month** (Gemini 2.5 Flash 무료 티어 기준)

---

## OMS Team Structure (16 Agents)

```
사용자 (PO)
    │
    ▼
┌─────────────────────────────────────────┐
│              PM AGENT                   │
│  요구사항 정의 / 태스크 분배 / 최종 QA  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│             TPM AI AGENT                │
│  스프린트 계획 / 아키텍처 / 실행 순서   │
└────────┬──────────────────────┬─────────┘
         │                      │
   ┌─────▼──────┐  ┌────────────▼───┐  ┌─────────────┐
   │Supervisor 1│  │  Supervisor 2  │  │Supervisor 3 │
   │ 데이터파이프│  │   분석 파이프   │  │아웃풋 파이프│
   └─────┬──────┘  └───────┬────────┘  └──────┬──────┘
         │                 │                  │
   ┌─────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
   │ MSA #1~4   │   │  MSA #5~8   │   │  MSA #9~11  │
   │뉴스·금융   │   │ 리스크·분석  │   │리포트·저장  │
   └────────────┘   └─────────────┘   └─────────────┘
```

---

## Agent Roles

### Management Layer

| 에이전트 | 역할 |
|---------|------|
| PM Agent | 사용자 요청 파싱, 태스크 정의, 최종 결과물 QA 승인 |
| TPM Agent | 기술 아키텍처 결정, 실행 순서 및 의존성 관리 |

### Context Supervisor Layer

| 에이전트 | 담당 MSA | 역할 |
|---------|---------|------|
| Supervisor #1 | MSA #1~4 | 데이터 수집 파이프라인 감독 |
| Supervisor #2 | MSA #5~8 | 분석 파이프라인 감독 |
| Supervisor #3 | MSA #9~11 | 아웃풋 파이프라인 감독 |

### MSA Layer (11 Microservice Agents)

| # | Agent | 역할 | 도구 |
|---|-------|------|------|
| 1 | NewsCollector | 지정학 뉴스 수집 | NewsAPI |
| 2 | EventClassifier | 전쟁/제재/분쟁 분류 | Gemini 2.5 Flash |
| 3 | SentimentAnalyzer | 시장 감정 분석 | Gemini 2.5 Flash |
| 4 | FinancialData | 주가/환율 수집 | yfinance + Yahoo Finance REST |
| 5 | RiskScorer | 섹터별 리스크 점수 | Gemini 2.5 Flash |
| 6 | PortfolioMapper | 종목 ↔ 리스크 매핑 | 내부 로직 |
| 7 | HistoricalAnalyzer | 과거 유사 이벤트 비교 | Gemini 2.5 Flash |
| 8 | AlertManager | 위험 임계값 알림 | 내부 로직 |
| 9 | ReportGenerator | 리스크 리포트 생성 | Gemini 2.5 Flash |
| 10 | Visualizer | 차트/대시보드 데이터 | 내부 로직 |
| 11 | DataStorage | 분석 이력 저장 | Supabase |

---

## Execution Pipeline

```
입력: ["삼성전자", "NVDA", "TSM"]
        ↓
[PM] 요청 파싱 → TPM에 위임
        ↓
[TPM] 실행 계획 수립
        ↓
[Supervisor 1] 뉴스 수집 → 이벤트 분류 → 감정 분석 → 주가 조회
        ↓
[Supervisor 2] 리스크 스코어링 → 포트폴리오 매핑 → 과거 비교 → 알림 생성
        ↓
[Supervisor 3] 리포트 생성 → 시각화 → DB 저장
        ↓
[PM] QA 검토 → 승인(APPROVED) 또는 재작업 지시
        ↓
출력: 리스크 리포트 + 대시보드
```

---

## Tech Stack

| 구분 | 기술 |
|------|------|
| Orchestration | LangGraph 0.2 |
| LLM | Google Gemini 2.5 Flash (Free Tier) |
| Backend | Python FastAPI |
| Frontend | Next.js 15 + Tailwind CSS + Recharts |
| News Data | NewsAPI |
| Financial Data | yfinance + Yahoo Finance REST API (폴백) |
| Database | Supabase (PostgreSQL) |
| Deploy | Vercel (Frontend) + Railway (Backend) |

---

## Project Structure

```
war-investment-agent/
├── backend/
│   ├── agents/
│   │   ├── pm_agent.py
│   │   ├── tpm_agent.py
│   │   ├── supervisors/
│   │   │   ├── supervisor_1.py
│   │   │   ├── supervisor_2.py
│   │   │   └── supervisor_3.py
│   │   └── msa/
│   │       ├── news_collector.py
│   │       ├── event_classifier.py
│   │       ├── sentiment_analyzer.py
│   │       ├── financial_data.py
│   │       ├── risk_scorer.py
│   │       ├── portfolio_mapper.py
│   │       ├── historical_analyzer.py
│   │       ├── alert_manager.py
│   │       ├── report_generator.py
│   │       ├── visualizer.py
│   │       └── data_storage.py
│   ├── graph/
│   │   ├── state.py          ← 공유 상태 (PortfolioState)
│   │   └── pipeline.py       ← LangGraph 파이프라인
│   ├── api/
│   │   └── main.py           ← FastAPI 엔드포인트
│   ├── utils/
│   │   └── gemini.py         ← Gemini 클라이언트 (재시도 로직 포함)
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── app/
    │   └── page.tsx
    ├── components/
    │   ├── PortfolioInput.tsx
    │   ├── Dashboard.tsx
    │   ├── RiskChart.tsx
    │   ├── AlertBanner.tsx
    │   ├── StockRiskTable.tsx
    │   └── ReportSection.tsx
    └── types/
        └── index.ts
```

---

## Getting Started

```bash
# 1. 레포 클론
git clone https://github.com/forexms78/war-investment-agent.git
cd war-investment-agent

# 2. 백엔드 설정
cd backend
pip install -r requirements.txt
cp .env.example .env
# .env에 API 키 입력

# 3. 백엔드 실행
cd ..
python -m uvicorn backend.api.main:app --reload --port 8000

# 4. 프론트엔드 설정 (새 터미널)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## Environment Variables

```bash
# backend/.env
GEMINI_API_KEY=your_gemini_api_key      # aistudio.google.com
NEWS_API_KEY=your_newsapi_key           # newsapi.org
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Supabase 테이블 초기화

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

## 기술적 의사결정 (Architecture Decision Records)

### 1. Airflow + LangGraph 이중 파이프라인

```
[Airflow DAG — 스케줄 레이어]          [LangGraph — AI 에이전트 레이어]
┌────────────────────────┐              ┌──────────────────────────────┐
│  @hourly cron          │              │  PM → TPM → Sup1 → Sup2     │
│  뉴스 수집              │──trigger──▶│  → Sup3 → PM QA              │
│  심각도 판별            │              │  (16 agents StateGraph)      │
│  LangGraph 트리거       │              └──────────────────────────────┘
└────────────────────────┘
```

- **Airflow**: 주기적 실행·재시도·분기(BranchPythonOperator) 등 데이터 파이프라인 스케줄링에 특화
- **LangGraph**: 에이전트 간 상태(State) 공유·조건 분기·루프 등 복잡한 AI 오케스트레이션에 특화
- 둘을 결합해 "어떤 조건에서 에이전트를 실행할지"와 "에이전트들이 어떻게 협업할지"를 역할에 맞게 분리

### 2. 공유 상태(PortfolioState) 기반 에이전트 통신

```python
class PortfolioState(TypedDict):
    raw_news: list          # MSA#1 → MSA#2
    events: list            # MSA#2 → MSA#3
    financial_data: dict    # MSA#4 → MSA#5
    risk_scores: dict       # MSA#5 → MSA#6
    final_report: str       # MSA#9 → PM QA
    pm_approved: bool       # PM QA 최종 결정
```

16개 에이전트가 개별 API를 호출하는 대신 **단일 TypedDict 상태를 공유**하여:
- 에이전트 간 결합도 최소화
- 중간 결과물 추적 및 디버깅 용이
- LangGraph 체크포인트로 실패 시 재시작 가능

### 3. PM QA 루프 — 자기 검증 메커니즘

에이전트가 생성한 리포트를 **동일 LLM이 PM 역할로 재검토**:
- `pm_approved=True` → 사용자에게 최종 결과 전달
- `pm_approved=False` → `pm_feedback`과 함께 재생성 요청

단순 체이닝이 아닌 **반성적 피드백 루프(Reflexion Pattern)** 구현

---

## 기술적 해결 사항

| 문제 | 원인 | 해결 |
|------|------|------|
| Yahoo Finance 데이터 수집 실패 | 한국 IP 차단 | User-Agent 헤더 + REST API 직접 호출 폴백 |
| Gemini API 429 오류 | 무료 티어 분당 요청 한도 | 30초 간격 자동 재시도 로직 (최대 3회) |
| Gemini 2.0 Flash quota 0 | AI Studio 외 경로 발급 키 제한 | Gemini 2.5 Flash 사용 |
| Supabase 저장 실패 | 네트워크 오류 | /tmp 로컬 JSON 폴백으로 데이터 유실 방지 |

---

## 면접 포인트 (Interview Talking Points)

**Q. 왜 16개 에이전트가 필요한가? 하나의 LLM으로 처리하면 안 되나?**

> 하나의 LLM에 모든 태스크를 맡기면 컨텍스트가 커질수록 성능이 저하됩니다. 각 에이전트가 자신의 전문 역할에만 집중하면 프롬프트가 간결해지고, 실패 시 해당 에이전트만 재실행할 수 있어 디버깅이 용이합니다. 또한 실제 조직의 역할 분리(PM/개발/QA)를 에이전트 구조로 표현함으로써 코드 유지보수성도 높아집니다.

**Q. Airflow와 LangGraph를 함께 쓴 이유는?**

> Airflow는 "언제, 어떤 조건에서 실행할지"를 담당하고, LangGraph는 "에이전트들이 어떻게 협업할지"를 담당합니다. 뉴스 수집과 심각도 판별은 Airflow DAG의 BranchPythonOperator로 처리하고, 심각 이벤트 발생 시에만 LangGraph 파이프라인을 트리거하는 이벤트 기반 아키텍처를 구현했습니다.

**Q. 비용 $0/month 가 실제로 가능한가?**

> Gemini 2.5 Flash 무료 티어(분당 10 요청, 월 1000회), NewsAPI 무료 플랜(월 100회), Supabase 무료 플랜(500MB), Vercel/Railway 무료 플랜으로 포트폴리오 수준에서는 완전 무료 운영이 가능합니다.

---

## 관련 프로젝트

- [claude-agent-orchestration](https://github.com/forexms78/claude-agent-orchestration) — OMS 팀 구조와 Memento 패턴 기반 AI Context 설계 시스템

---

## License

MIT
