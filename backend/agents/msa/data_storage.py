import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Supabase는 선택적으로 사용 — 없으면 로컬 JSON 저장
try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    supabase = None


def store_analysis(
    portfolio: list[str],
    report: str,
    visualization_data: dict,
    risk_scores: dict,
) -> bool:
    payload = {
        "created_at": datetime.now().isoformat(),
        "portfolio": portfolio,
        "report": report,
        "overall_risk_level": risk_scores.get("overall_risk_level", "중간"),
        "visualization_data": visualization_data,
    }

    if supabase:
        try:
            supabase.table("analyses").insert(payload).execute()
            return True
        except Exception:
            pass

    # fallback: 로컬 파일 저장
    try:
        path = f"/tmp/war_inve_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False
