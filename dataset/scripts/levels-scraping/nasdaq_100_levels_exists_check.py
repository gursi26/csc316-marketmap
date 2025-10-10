import csv
import subprocess
import os
import sys

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'nasdaq_100_levels.csv'))
MAIN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'main.py'))

# Read CSV and add 'exists-on-levels' column if missing, set all to 'false' if new
rows = []
with open(CSV_PATH, newline='', encoding='utf-8') as f:
    reader = list(csv.DictReader(f))
    fieldnames = reader[0].keys() if reader else ['Company Name', 'Stock Ticker']
    if 'exists-on-levels' not in fieldnames:
        fieldnames = list(fieldnames) + ['exists-on-levels']
        for row in reader:
            row['exists-on-levels'] = 'false'
    else:
        for row in reader:
            if row['exists-on-levels'] not in ('true', 'false'):
                row['exists-on-levels'] = 'false'
    rows = reader

# Write back with the new column if it was missing
with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

# Now, for each row with 'exists-on-levels' == 'false', check existence
for i, row in enumerate(rows):
    if row.get('exists-on-levels', 'false') == 'true':
        continue
    company = row['Company Name'].strip().lower().replace(' ', '-')
    print(f"Checking: {company}")
    try:
        result = subprocess.run([
            sys.executable, MAIN_PATH, company, '--exists', '--headless'
        ], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  Exists: {company}")
            rows[i]['exists-on-levels'] = 'true'
        else:
            print(f"  Does not exist: {company}")
    except Exception as e:
        print(f"  Error checking {company}: {e}")

    # Write after each check to persist progress
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
