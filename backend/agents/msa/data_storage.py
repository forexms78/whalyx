import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

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
            print("[DataStorage] Supabase 저장 완료")
            return True
        except Exception as e:
            print(f"[DataStorage] Supabase 저장 실패: {e}")

    # fallback: 로컬 파일 저장
    try:
        path = f"/tmp/war_inve_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"[DataStorage] 로컬 저장 완료: {path}")
        return True
    except Exception:
        return False
