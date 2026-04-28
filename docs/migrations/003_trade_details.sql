-- 매매 상세 분석 기록 컬럼 추가
ALTER TABLE auto_trades ADD COLUMN IF NOT EXISTS details  JSONB;
ALTER TABLE auto_trades ADD COLUMN IF NOT EXISTS market   TEXT NOT NULL DEFAULT 'KR';

-- 인덱스 (시장별 조회용)
CREATE INDEX IF NOT EXISTS idx_auto_trades_market ON auto_trades(market);
CREATE INDEX IF NOT EXISTS idx_auto_trades_executed_at ON auto_trades(executed_at DESC);
