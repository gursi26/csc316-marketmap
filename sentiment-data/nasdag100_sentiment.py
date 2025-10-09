import requests
import csv
from datetime import datetime, timedelta
import time
import json
import os

# ===================== CONFIG =====================
API_TOKEN = "YOUR API HERE"
# Replace with the full list of NASDAQ-100 tickers
TICKERS = [
    "AAPL","MSFT","GOOG","AMZN","TSLA","META","NVDA","NFLX","PEP","ADBE",
    "INTC","CSCO","CMCSA","AVGO","PYPL","TXN","COST","QCOM","AMGN","SBUX",
    "AMD","HON","GILD","ISRG","BKNG","ADP","MDLZ","VRTX","REGN","LRCX",
    "FISV","INTU","MRNA","MU","ZM","IDXX","ASML","ATVI","KHC","BIIB",
    "MELI","DOCU","ADSK","EA","WDAY","SNPS","ILMN","ROST","CTAS","EBAY",
    "KLAC","MNST","CDNS","CTSH","ORLY","DLTR","LULU","FAST","XEL","CTXS",
    "NXPI","PCAR","SIRI","MAR","SGEN","EXC","ODFL","PAYX","ALGN","SWKS",
    "TEAM","WBA","ADI","VRSK","CDW","BIDU","CHTR","VRSN","INCY","WDAY",
    "ANSS","CPRT","UAL","TTWO","REG","HPE","EXPE","MCHP","VRSN","XLNX",
    "BKNG","MXIM","PAYC","CTAS","TECH","WDAY"
]
MAX_TICKERS_PER_CALL = 10  # Batch size
START_DATE = datetime(2024, 1, 1)
END_DATE = datetime(2025, 9, 30)
CSV_FILE = "nasdaq100_weekly_sentiment.csv"
PROGRESS_FILE = "progress.json"

# =========================
# HELPER FUNCTIONS
# =========================
def week_ranges(start, end):
    current = start
    while current <= end:
        week_end = min(current + timedelta(days=6), end)
        yield current, week_end
        current = week_end + timedelta(days=1)

def fetch_news(tickers_batch, start, end):
    url = "https://api.marketaux.com/v1/news/all"
    params = {
        "countries": "us",
        "symbols": ",".join(tickers_batch),
        "filter_entities": "true",
        "limit": 50,  # max articles per request
        "published_after": start.isoformat(),
        "published_before": end.isoformat(),
        "api_token": API_TOKEN
    }
    response = requests.get(url, params=params)
    
    if response.status_code == 402:  # usage limit reached
        print("API limit reached. Stopping script.")
        return None
    
    if response.status_code != 200:
        print(f"API error: {response.status_code} {response.text}")
        return None
    
    return response.json()

def calculate_weekly_sentiment(news_data, tickers_batch):
    weekly_scores = {}
    for ticker in tickers_batch:
        ticker_scores = []
        for article in news_data.get("data", []):
            for entity in article.get("entities", []):
                if entity.get("symbol") == ticker and entity.get("sentiment_score") is not None:
                    ticker_scores.append(entity["sentiment_score"])
        # if no news, sentiment = 0
        avg_sentiment = round(sum(ticker_scores)/len(ticker_scores), 2) if ticker_scores else 0
        weekly_scores[ticker] = avg_sentiment
    return weekly_scores

def save_weekly_sentiment(csv_file, week_start, week_end, weekly_scores):
    file_exists = os.path.isfile(csv_file)
    with open(csv_file, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["ticker", "start_date", "end_date", "sentiment_score"])
        for ticker, score in weekly_scores.items():
            writer.writerow([ticker, week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d"), score])

def save_progress(progress_file, week_start):
    with open(progress_file, "w") as f:
        json.dump({"last_week_start": week_start.strftime("%Y-%m-%d")}, f)

def load_progress(progress_file):
    if os.path.isfile(progress_file):
        try:
            with open(progress_file, "r") as f:
                data = json.load(f)
                if "last_week_start" in data:
                    return datetime.strptime(data["last_week_start"], "%Y-%m-%d")
        except (json.JSONDecodeError, ValueError):
            pass  # ignore invalid file
    return None

# =========================
# MAIN SCRIPT
# =========================
def main():
    last_processed = load_progress(PROGRESS_FILE)
    start_date = last_processed + timedelta(days=7) if last_processed else START_DATE
    
    for week_start, week_end in week_ranges(start_date, END_DATE):
        print(f"Processing week {week_start.date()} to {week_end.date()}")
        
        # Process tickers in batches
        for i in range(0, len(TICKERS), MAX_TICKERS_PER_CALL):
            batch = TICKERS[i:i+MAX_TICKERS_PER_CALL]
            news_data = fetch_news(batch, week_start, week_end)
            if news_data is None:
                # Stop processing if API limit reached
                return
            weekly_scores = calculate_weekly_sentiment(news_data, batch)
            save_weekly_sentiment(CSV_FILE, week_start, week_end, weekly_scores)
        
        # Save progress after each week
        save_progress(PROGRESS_FILE, week_start)
        time.sleep(1)  # avoid hitting rate limits too fast

if __name__ == "__main__":
    main()