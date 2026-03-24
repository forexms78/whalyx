from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.graph.pipeline import run_analysis

app = FastAPI(title="War-Investment Agent API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    user_request: str = "내 포트폴리오의 지정학 리스크를 분석해줘"
    portfolio: list[str]


class AnalysisResponse(BaseModel):
    final_report: str | None
    alerts: list[str] | None
    visualization_data: dict | None
    portfolio_risk_mapping: dict | None
    overall_risk_level: str | None
    pm_approved: bool | None = True
    pm_feedback: str | None = None


@app.get("/")
def health_check():
    return {"status": "ok", "service": "War-Investment Agent"}


@app.post("/analyze", response_model=AnalysisResponse)
def analyze_portfolio(request: AnalysisRequest):
    if not request.portfolio:
        raise HTTPException(status_code=400, detail="포트폴리오를 1개 이상 입력하세요")

    try:
        result = run_analysis(request.user_request, request.portfolio)
        analysis = result.get("analysis") or {}
        risk_scores = analysis.get("risk_scores") or {}
        return AnalysisResponse(
            final_report=result.get("final_report"),
            alerts=result.get("alerts"),
            visualization_data=result.get("visualization_data"),
            portfolio_risk_mapping=result.get("portfolio_risk_mapping"),
            overall_risk_level=risk_scores.get("overall_risk_level"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
