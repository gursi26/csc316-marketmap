import yfinance as yf
import pandas as pd

def main():
	financials = pd.read_csv('cleaned/Company-financials.csv')
	tickers = financials['Ticker'].tolist()
	
	all_data = []
	years = [2022, 2023, 2024, 2025]
	
	for ticker in tickers:
		print(f"Fetching {ticker}...")
		stock = yf.Ticker(ticker)
		shares_outstanding = stock.info.get('sharesOutstanding', None)
		
		for year in years:
			start_date = f'{year}-01-01'
			if year != 2025:
				df = stock.history(start=start_date, end=f'{int(year)+1}-01-01', interval='1wk')
			else:
				df = stock.history(start=start_date, interval='1wk')

			if len(df) == 0:
				print(f"No data found for {ticker} in {year}")
				continue
				
			df = df.reset_index()
			
			if shares_outstanding:
				df['Market Cap'] = df['Close'] * shares_outstanding
			else:
				df['Market Cap'] = None
			
			df['Ticker'] = ticker
			df = df[['Date', 'Ticker', 'Close', 'Market Cap', 'Volume', 'Dividends', 'Stock Splits']]
			# store the date as a string yyyy-mm-dd WITHOUT TIMEZONE
			df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
			all_data.append(df)
	
	result = pd.concat(all_data, ignore_index=False)

	sentiment = pd.read_csv("cleaned/combined_sentiment.csv")
	# merge on sentiment.start_date = result.Date and sentiment.ticker = result.Ticker
	result = result.merge(sentiment, left_on=['Date', 'Ticker'], right_on=['start_date', 'ticker'], how='left')
	result.drop(columns=['start_date', 'end_date', 'ticker'], inplace=True)
	result.to_csv('cleaned/Company-financials-sentiment-weekly-snapshot.csv', index=False)
	print(f"\nWrote {len(result)} rows to Company-financials-weekly-snapshot.csv")

if __name__ == "__main__":
	main()
