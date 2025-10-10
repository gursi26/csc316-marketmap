import csv
import yfinance as yf
import os

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'nasdaq_100_levels.csv'))

# Read CSV and add 'country' column if missing, set all to 'unknown' if new
rows = []
with open(CSV_PATH, newline='', encoding='utf-8') as f:
    reader = list(csv.DictReader(f))
    fieldnames = reader[0].keys() if reader else ['Company Name', 'Stock Ticker']
    if 'country' not in fieldnames:
        fieldnames = list(fieldnames) + ['country']
        for row in reader:
            row['country'] = 'unknown'
    else:
        for row in reader:
            if not row.get('country'):
                row['country'] = 'unknown'
    rows = reader

# Write back with the new column if it was missing
with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

# For each row with 'country' == 'unknown', look up country using yfinance
for i, row in enumerate(rows):
    if row.get('country', 'unknown') != 'unknown':
        continue
    ticker = row['Stock Ticker'].strip().upper()
    print(f"Looking up: {ticker}")
    try:
        info = yf.Ticker(ticker).info
        country = info.get('country', 'unknown')
        print(f"  Country: {country}")
        rows[i]['country'] = country
    except Exception as e:
        print(f"  Error looking up {ticker}: {e}")
        rows[i]['country'] = 'unknown'
    # Write after each check to persist progress
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
