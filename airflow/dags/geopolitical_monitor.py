"""
Geopolitical Risk Monitor DAG
==============================
매 1시간마다 지정학 뉴스를 수집하고,
심각도 높은 이벤트 감지 시 LangGraph 파이프라인을 트리거하여
포트폴리오 리스크 분석을 자동 실행합니다.

면접 포인트:
- Airflow로 스케줄링 + LangGraph로 AI 에이전트 오케스트레이션
- 데이터 엔지니어링 + AI 에이전트를 결합한 파이프라인
"""

from datetime import datetime, timedelta
import requests
import json
import os

from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.models import Variable

# 모니터링할 기본 포트폴리오 (환경변수로 변경 가능)
DEFAULT_PORTFOLIO = ["삼성전자", "NVDA", "TSM", "AAPL", "LMT"]
SEVERITY_THRESHOLD = "높음"  # 이 심각도 이상일 때만 전체 분석 트리거
NEWS_API_KEY = Variable.get("NEWS_API_KEY", default_var=os.getenv("NEWS_API_KEY", ""))
API_URL = Variable.get("API_URL", default_var="http://host.docker.internal:8000")

GEOPOLITICAL_KEYWORDS = "war OR conflict OR sanctions OR military OR invasion OR 전쟁 OR 제재 OR 분쟁"

default_args = {
    "owner": "oms-team",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": False,
}


def collect_news(**context):
    """MSA #1: NewsCollector — 지정학 뉴스 수집"""
    params = {
        "q": GEOPOLITICAL_KEYWORDS,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 10,
        "apiKey": NEWS_API_KEY,
    }
    try:
        r = requests.get("https://newsapi.org/v2/everything", params=params, timeout=10)
        articles = r.json().get("articles", [])
        context["ti"].xcom_push(key="raw_news", value=articles[:10])
        print(f"[NewsCollector] {len(articles)}건 수집 완료")
        return len(articles)
    except Exception as e:
        print(f"[NewsCollector] 오류: {e}")
        context["ti"].xcom_push(key="raw_news", value=[])
        return 0


def check_severity(**context):
    """심각도 체크 — 높음/매우높음 이벤트가 있으면 분석 트리거"""
    raw_news = context["ti"].xcom_pull(key="raw_news")
    if not raw_news:
        return "skip_analysis"

    # 심각 키워드 탐지
    high_severity_keywords = [
        "war", "invasion", "military strike", "sanctions imposed",
        "nuclear", "missile", "전쟁", "침공", "군사 공격"
    ]
    found = []
    for article in raw_news:
        title = (article.get("title") or "").lower()
        desc = (article.get("description") or "").lower()
        for kw in high_severity_keywords:
            if kw in title or kw in desc:
                found.append({"keyword": kw, "title": article["title"]})
                break

    print(f"[Severity Check] 심각 이벤트 {len(found)}건 감지")
    context["ti"].xcom_push(key="high_severity_events", value=found)

    if found:
        return "trigger_analysis"
    return "skip_analysis"


def trigger_langgraph_pipeline(**context):
    """LangGraph 파이프라인 트리거 — 전체 16-agent 분석 실행"""
    high_severity = context["ti"].xcom_pull(key="high_severity_events") or []
    event_summary = ", ".join([e["keyword"] for e in high_severity[:3]])

    payload = {
        "user_request": f"지정학 고위험 이벤트 감지됨: {event_summary}. 포트폴리오 긴급 리스크 분석 요청.",
        "portfolio": DEFAULT_PORTFOLIO,
    }

    try:
        r = requests.post(f"{API_URL}/analyze", json=payload, timeout=180)
        r.raise_for_status()
        result = r.json()
        print(f"[LangGraph] 분석 완료 — 전체 리스크: {result.get('overall_risk_level')}")
        print(f"[LangGraph] PM 승인: {result.get('pm_approved')}")

        alerts = result.get("alerts") or []
        for alert in alerts:
            print(f"[ALERT] {alert}")

        context["ti"].xcom_push(key="analysis_result", value=result)
        return result
    except Exception as e:
        print(f"[LangGraph] 파이프라인 오류: {e}")
        raise


def log_monitoring_result(**context):
    """모니터링 결과 로깅"""
    high_severity = context["ti"].xcom_pull(task_ids="check_severity", key="high_severity_events") or []
    print(f"[Monitor] 이번 사이클 완료 — 감지된 고위험 이벤트: {len(high_severity)}건")
    print(f"[Monitor] 다음 실행: 1시간 후")


with DAG(
    dag_id="geopolitical_risk_monitor",
    description="지정학 리스크 자동 모니터링 → LangGraph 파이프라인 트리거",
    default_args=default_args,
    start_date=datetime(2026, 1, 1),
    schedule_interval="@hourly",
    catchup=False,
    tags=["oms", "geopolitical", "langgraph", "portfolio"],
) as dag:

    start = EmptyOperator(task_id="start")

    collect = PythonOperator(
        task_id="collect_news",
        python_callable=collect_news,
    )

    severity_check = BranchPythonOperator(
        task_id="check_severity",
        python_callable=check_severity,
    )

    trigger = PythonOperator(
        task_id="trigger_analysis",
        python_callable=trigger_langgraph_pipeline,
    )

    skip = EmptyOperator(task_id="skip_analysis")

    log_result = PythonOperator(
        task_id="log_result",
        python_callable=log_monitoring_result,
        trigger_rule="none_failed_min_one_success",
    )

    end = EmptyOperator(
        task_id="end",
        trigger_rule="none_failed_min_one_success",
    )

    # DAG 흐름
    start >> collect >> severity_check
    severity_check >> trigger >> log_result >> end
    severity_check >> skip >> end
