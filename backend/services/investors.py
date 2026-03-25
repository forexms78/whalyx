"""
유명 투자자 포트폴리오 데이터
출처: 최신 13F 공시, SEC 인사이더 파일링, 공개 뉴스 기반 큐레이션
"""

INVESTORS = {
    "cathie-wood": {
        "id": "cathie-wood",
        "name": "Cathie Wood",
        "title": "ARK Invest CEO",
        "firm": "ARK Invest",
        "country": "US",
        "avatar_initial": "CW",
        "color": "#6C3483",
        "description": "파괴적 혁신 기업 전문 투자자. AI, 바이오, 핀테크, 우주 섹터 집중.",
        "known_for": "TSLA 초기 대규모 매수, COIN 강세론",
        "portfolio": [
            {"ticker": "TSLA", "name": "Tesla", "weight": 14.2, "shares": 8_200_000, "action": "hold"},
            {"ticker": "COIN", "name": "Coinbase", "weight": 10.8, "shares": 5_100_000, "action": "buy"},
            {"ticker": "ROKU", "name": "Roku", "weight": 8.1, "shares": 12_300_000, "action": "hold"},
            {"ticker": "PLTR", "name": "Palantir", "weight": 7.5, "shares": 22_000_000, "action": "buy"},
            {"ticker": "SHOP", "name": "Shopify", "weight": 6.3, "shares": 3_800_000, "action": "hold"},
            {"ticker": "RBLX", "name": "Roblox", "weight": 5.2, "shares": 9_400_000, "action": "hold"},
            {"ticker": "U",    "name": "Unity Software", "weight": 4.1, "shares": 11_200_000, "action": "sell"},
        ],
        "recent_moves": "2024년 PLTR 및 COIN 추가 매수. TSLA 일부 차익 실현.",
    },
    "warren-buffett": {
        "id": "warren-buffett",
        "name": "Warren Buffett",
        "title": "Berkshire Hathaway CEO",
        "firm": "Berkshire Hathaway",
        "country": "US",
        "avatar_initial": "WB",
        "color": "#1A5276",
        "description": "가치 투자의 전설. 장기 보유, 경제적 해자를 가진 우량주 집중.",
        "known_for": "코카콜라 30년 보유, AAPL 대규모 투자",
        "portfolio": [
            {"ticker": "AAPL", "name": "Apple", "weight": 45.2, "shares": 900_000_000, "action": "sell"},
            {"ticker": "BAC",  "name": "Bank of America", "weight": 10.1, "shares": 1_032_000_000, "action": "sell"},
            {"ticker": "AXP",  "name": "American Express", "weight": 9.8, "shares": 151_000_000, "action": "hold"},
            {"ticker": "KO",   "name": "Coca-Cola", "weight": 8.5, "shares": 400_000_000, "action": "hold"},
            {"ticker": "CVX",  "name": "Chevron", "weight": 6.3, "shares": 118_000_000, "action": "hold"},
            {"ticker": "OXY",  "name": "Occidental Petroleum", "weight": 5.7, "shares": 255_000_000, "action": "buy"},
            {"ticker": "KHC",  "name": "Kraft Heinz", "weight": 4.1, "shares": 325_000_000, "action": "hold"},
        ],
        "recent_moves": "AAPL 및 BAC 지분 일부 축소. OXY 지속 매수 중.",
    },
    "jensen-huang": {
        "id": "jensen-huang",
        "name": "Jensen Huang",
        "title": "NVIDIA CEO & Co-Founder",
        "firm": "NVIDIA",
        "country": "US",
        "avatar_initial": "JH",
        "color": "#1E8449",
        "description": "AI 반도체 혁명을 이끄는 NVIDIA CEO. GPU 컴퓨팅으로 AI 시대 개척.",
        "known_for": "CUDA 생태계 구축, AI 붐의 핵심 수혜주",
        "portfolio": [
            {"ticker": "NVDA", "name": "NVIDIA", "weight": 96.0, "shares": 75_000_000, "action": "hold"},
            {"ticker": "ARM",  "name": "Arm Holdings", "weight": 2.5, "shares": 1_200_000, "action": "hold"},
            {"ticker": "SMCI", "name": "Super Micro Computer", "weight": 1.5, "shares": 500_000, "action": "hold"},
        ],
        "recent_moves": "NVDA 인사이더 매도 일부 실행 (세금 계획 목적). 주가 사상 최고치 경신.",
    },
    "bill-gates": {
        "id": "bill-gates",
        "name": "Bill Gates",
        "title": "게이츠 재단 공동의장",
        "firm": "Bill & Melinda Gates Foundation",
        "country": "US",
        "avatar_initial": "BG",
        "color": "#D35400",
        "description": "마이크로소프트 창업자. 현재 자선 활동 및 장기 가치 투자 중심.",
        "known_for": "MSFT 창업, 게이츠 재단 통한 ESG 투자",
        "portfolio": [
            {"ticker": "MSFT", "name": "Microsoft", "weight": 33.8, "shares": 39_000_000, "action": "hold"},
            {"ticker": "BRK.B","name": "Berkshire Hathaway B", "weight": 17.1, "shares": 19_000_000, "action": "hold"},
            {"ticker": "WM",   "name": "Waste Management", "weight": 14.2, "shares": 35_000_000, "action": "hold"},
            {"ticker": "CAT",  "name": "Caterpillar", "weight": 10.5, "shares": 9_000_000, "action": "buy"},
            {"ticker": "CNI",  "name": "Canadian National Railway", "weight": 9.3, "shares": 54_000_000, "action": "hold"},
            {"ticker": "WFC",  "name": "Wells Fargo", "weight": 5.8, "shares": 21_000_000, "action": "buy"},
        ],
        "recent_moves": "CAT 및 WFC 신규 매수. 인프라·소비재 섹터 비중 확대 중.",
    },
    "michael-burry": {
        "id": "michael-burry",
        "name": "Michael Burry",
        "title": "Scion Asset Management 설립자",
        "firm": "Scion Asset Management",
        "country": "US",
        "avatar_initial": "MB",
        "color": "#922B21",
        "description": "'빅쇼트'의 주인공. 역발상 투자로 유명. 중국 테크 및 가치주 집중.",
        "known_for": "2008 서브프라임 위기 공매도, 중국 테크주 저점 매수",
        "portfolio": [
            {"ticker": "BABA", "name": "Alibaba", "weight": 28.5, "shares": 2_500_000, "action": "buy"},
            {"ticker": "JD",   "name": "JD.com", "weight": 22.1, "shares": 5_200_000, "action": "buy"},
            {"ticker": "GEO",  "name": "GEO Group", "weight": 15.3, "shares": 4_800_000, "action": "hold"},
            {"ticker": "REAL", "name": "RealReal", "weight": 10.2, "shares": 18_000_000, "action": "hold"},
            {"ticker": "CPRI", "name": "Capri Holdings", "weight": 8.7, "shares": 3_100_000, "action": "hold"},
        ],
        "recent_moves": "중국 테크주(BABA, JD) 추가 매수. 미국 소비재 일부 정리.",
    },
    "mark-zuckerberg": {
        "id": "mark-zuckerberg",
        "name": "Mark Zuckerberg",
        "title": "Meta CEO & Co-Founder",
        "firm": "Meta Platforms",
        "country": "US",
        "avatar_initial": "MZ",
        "color": "#1877F2",
        "description": "Meta(Facebook, Instagram, WhatsApp) 창업자. AI 및 AR/VR 미래 베팅.",
        "known_for": "소셜미디어 제국 구축, Reality Labs VR 투자",
        "portfolio": [
            {"ticker": "META", "name": "Meta Platforms", "weight": 99.5, "shares": 350_000_000, "action": "hold"},
        ],
        "recent_moves": "META 주가 사상 최고치. AI 인프라 투자 연간 $600억 달러 발표.",
    },
    "lisa-su": {
        "id": "lisa-su",
        "name": "Lisa Su",
        "title": "AMD CEO & President",
        "firm": "Advanced Micro Devices",
        "country": "US",
        "avatar_initial": "LS",
        "color": "#E40000",
        "description": "AMD를 AI 반도체 경쟁자로 탈바꿈시킨 CEO. MI300X로 엔비디아에 도전.",
        "known_for": "AMD 터너라운드, Xilinx 인수, MI300 AI 가속기",
        "portfolio": [
            {"ticker": "AMD",  "name": "AMD", "weight": 98.0, "shares": 3_800_000, "action": "hold"},
        ],
        "recent_moves": "MI300X AI 칩 수요 급증으로 2024 매출 가이던스 상향. 인사이더 주식 일부 매도.",
    },
    "ray-dalio": {
        "id": "ray-dalio",
        "name": "Ray Dalio",
        "title": "Bridgewater Associates 창업자",
        "firm": "Bridgewater Associates",
        "country": "US",
        "avatar_initial": "RD",
        "color": "#117A65",
        "description": "세계 최대 헤지펀드 Bridgewater 창업자. 올웨더 포트폴리오 전략 창시자.",
        "known_for": "All Weather 포트폴리오, 원칙(Principles) 저서",
        "portfolio": [
            {"ticker": "SPY",  "name": "S&P 500 ETF", "weight": 18.5, "shares": 4_200_000, "action": "hold"},
            {"ticker": "GLD",  "name": "Gold ETF", "weight": 15.2, "shares": 6_800_000, "action": "buy"},
            {"ticker": "EEM",  "name": "Emerging Markets ETF", "weight": 12.3, "shares": 8_900_000, "action": "hold"},
            {"ticker": "VWO",  "name": "Vanguard EM ETF", "weight": 9.8, "shares": 7_200_000, "action": "hold"},
            {"ticker": "IEMG", "name": "iShares Core EM ETF", "weight": 8.1, "shares": 5_500_000, "action": "hold"},
            {"ticker": "BABA", "name": "Alibaba", "weight": 7.4, "shares": 3_100_000, "action": "buy"},
            {"ticker": "PDD",  "name": "PDD Holdings", "weight": 5.6, "shares": 2_800_000, "action": "buy"},
        ],
        "recent_moves": "금(GLD) 비중 확대. 중국 소비주(BABA, PDD) 신규 편입.",
    },
}


def get_all_investors() -> list[dict]:
    return [
        {
            "id": v["id"],
            "name": v["name"],
            "title": v["title"],
            "firm": v["firm"],
            "avatar_initial": v["avatar_initial"],
            "color": v["color"],
            "description": v["description"],
            "top_holdings": [p["ticker"] for p in v["portfolio"][:3]],
            "recent_moves": v["recent_moves"],
        }
        for v in INVESTORS.values()
    ]


def get_investor(investor_id: str) -> dict | None:
    return INVESTORS.get(investor_id)


def get_hot_tickers() -> list[str]:
    """유명 투자자들이 공통으로 많이 보유하거나 최근 매수한 종목"""
    ticker_count: dict[str, int] = {}
    for investor in INVESTORS.values():
        for holding in investor["portfolio"]:
            if holding["action"] in ("buy", "hold"):
                ticker_count[holding["ticker"]] = ticker_count.get(holding["ticker"], 0) + 1
    sorted_tickers = sorted(ticker_count, key=lambda t: ticker_count[t], reverse=True)
    return sorted_tickers[:10]
