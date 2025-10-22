import yfinance as yf
import pandas as pd

def main():
    financials = pd.read_csv('cleaned/Company-financials.csv')
    tickers = financials['Ticker'].tolist()
    
    all_data = []
    for ticker in tickers:
        print(f"Fetching {ticker}...")
        stock = yf.Ticker(ticker)
        df = stock.history(start='2022-01-01', interval='1wk')
        shares_outstanding = stock.info.get('sharesOutstanding', None)
        if shares_outstanding:
            df['Market Cap'] = df['Close'] * shares_outstanding
        else:
            df['Market Cap'] = None
        df['Ticker'] = ticker
        df = df[['Ticker', 'Close', 'Market Cap', 'Volume', 'Dividends', 'Stock Splits']]
        all_data.append(df)
    
    result = pd.concat(all_data, ignore_index=False)
    result.to_csv('cleaned/Company-financials-weekly-snapshot.csv')
    print(f"\nWrote {len(result)} rows to Company-financials-weekly-snapshot.csv")

if __name__ == "__main__":
    main()
