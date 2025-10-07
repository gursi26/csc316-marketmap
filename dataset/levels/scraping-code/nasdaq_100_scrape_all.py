import csv
import subprocess
import os
import sys
import argparse

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'nasdaq_100_levels.csv'))
MAIN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'main.py'))

def main():
    parser = argparse.ArgumentParser(description='Run main.py for all companies in CSV that have not been scraped.')
    parser.add_argument('--limit', type=int, default=10, help='Max number of role links to process (passed to main.py)')
    parser.add_argument('--headless', action='store_true', help='Run browser in headless mode (passed to main.py)')
    args = parser.parse_args()

    # Read CSV and add 'scraped' and 'skip' columns if missing, set all to 'false' if new
    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = list(csv.DictReader(f))
        fieldnames = reader[0].keys() if reader else ['Company Name', 'Stock Ticker', 'country']
        updated = False
        if 'scraped' not in fieldnames:
            fieldnames = list(fieldnames) + ['scraped']
            for row in reader:
                row['scraped'] = 'false'
            updated = True
        if 'skip' not in fieldnames:
            fieldnames = list(fieldnames) + ['skip']
            for row in reader:
                row['skip'] = 'false'
            updated = True
        else:
            for row in reader:
                if row['skip'] not in ('true', 'false'):
                    row['skip'] = 'false'
        for row in reader:
            if 'scraped' in row and row['scraped'] not in ('true', 'false'):
                row['scraped'] = 'false'
        rows = reader

    # Write back with the new column(s) if they were missing
    if updated:
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    # For each row with 'scraped' == 'false', run main.py
    total_companies = sum(1 for row in rows if row.get('scraped', 'false') == 'false' and row.get('skip', 'false') != 'true' and row.get('exists-on-levels', 'false') == 'true')
    company_counter = 0
    for i, row in enumerate(rows):
        if row.get('scraped', 'false') == 'true':
            continue
        if row.get('skip', 'false') == 'true':
            print(f"Skipping {row['Company Name']}: skip is true.")
            continue
        if row.get('exists-on-levels', 'false') == 'false':
            print(f"Skipping {row['Company Name']}: exists-on-levels is false.")
            continue
        company_counter += 1
        company = row['Company Name'].strip().lower().replace(' ', '-')
        country = row.get('country', '').strip()
        if not country or country == 'unknown':
            print(f"Skipping {company}: country unknown.")
            continue
        print(f"Scraping company {company_counter}/{total_companies}: {company} ({country})")
        cmd = [sys.executable, MAIN_PATH, company, country, '--limit', str(args.limit)]
        if args.headless:
            cmd.append('--headless')
        try:
            result = subprocess.run(cmd, text=True)
            if result.returncode == 0:
                rows[i]['scraped'] = 'true'
            else:
                print(f"  main.py failed for {company}", file=sys.stderr)
        except Exception as e:
            print(f"  Error scraping {company}: {e}")
        # Write after each check to persist progress
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

if __name__ == '__main__':
    main()
