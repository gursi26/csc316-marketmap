import os
import csv
import argparse
import re

# Output columns
OUTPUT_COLS = [
    "company name",
    "company ticker",
    "company location",
    "role name",
    "role rank",
    "role level",
    "total pay (USD)",
    "base pay (USD)",
    "stock (USD)",
    "bonus (USD)",
    "upper bound (USD)",
    "lower bound (USD)",
    "years at company",
    "years of experience"
]

BENEFIT_OUTPUT_COLS = [
    "company name",
    "company ticker",
    "company location",
    "benefit category",
    "benefit",
]

# Helper to read nasdaq_100_levels.csv into a dict
def read_company_info(csv_path):
    info = {}
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            slug = row['Company Name'].strip().lower().replace(' ', '-')
            info[slug] = {
                'company name': row['Company Name'],
                'company ticker': row['Stock Ticker'],
                'company location': row['country']
            }
    return info

# Helper to parse salary strings to numbers
def parse_usd(s):
    if not s or s.strip() == '--':
        return ''
    s = s.replace('US$', '').replace('CA$', '').replace('$', '').replace(',', '').strip()
    if not s or s == '--':
        return ''
    # Handle K/M
    m = re.match(r'^[\d.]+[KM]?$', s)
    if not m:
        try:
            return str(int(float(s)))
        except Exception:
            return ''
    num = s
    mult = ''
    if s.endswith('K') or s.endswith('M'):
        mult = s[-1]
        num = s[:-1]
    try:
        val = float(num)
        if mult == 'K':
            val *= 1_000
        elif mult == 'M':
            val *= 1_000_000
        return str(int(val))
    except Exception:
        return ''

# Helper to identify file type and parse
def parse_salary_csv(path, role_folder_name):
    with open(path, newline='', encoding='utf-8') as f:
        reader = list(csv.reader(f))
        if not reader or len(reader) < 2:
            return []
        header = [h.strip().lower() for h in reader[0]]
        rows = reader[1:]
        # Table case
        if 'level name' in header and 'total' in header:
            idx_level = header.index('level name')
            idx_total = header.index('total')
            idx_base = header.index('base') if 'base' in header else -1
            idx_stock = header.index('stock (/yr)') if 'stock (/yr)' in header else -1
            idx_bonus = header.index('bonus') if 'bonus' in header else -1
            out = []
            for i, row in enumerate(rows):
                if not any(row):
                    continue
                out.append({
                    'role name': role_folder_name,
                    'role rank': str(i+1),
                    'role level': row[idx_level] if idx_level >= 0 else '',
                    'total pay (USD)': parse_usd(row[idx_total]) if idx_total >= 0 else '',
                    'base pay (USD)': parse_usd(row[idx_base]) if idx_base >= 0 else '',
                    'stock (USD)': parse_usd(row[idx_stock]) if idx_stock >= 0 else '',
                    'bonus (USD)': parse_usd(row[idx_bonus]) if idx_bonus >= 0 else '',
                })
            return out
        # Median case
        elif 'total per year' in header:
            idx_total = header.index('total per year')
            idx_base = header.index('base') if 'base' in header else -1
            idx_stock = header.index('stock (/yr)') if 'stock (/yr)' in header else -1
            idx_bonus = header.index('bonus') if 'bonus' in header else -1
            idx_level = header.index('level') if 'level' in header else -1
            idx_years_at_company = header.index('years at company') if 'years at company' in header else -1
            idx_years_exp = header.index('years experience') if 'years experience' in header else -1
            row = rows[0] if rows else []
            return [{
                'role name': role_folder_name,
                'role rank': '',
                'role level': row[idx_level] if idx_level >= 0 else '',
                'total pay (USD)': parse_usd(row[idx_total]) if idx_total >= 0 else '',
                'base pay (USD)': parse_usd(row[idx_base]) if idx_base >= 0 else '',
                'stock (USD)': parse_usd(row[idx_stock]) if idx_stock >= 0 else '',
                'bonus (USD)': parse_usd(row[idx_bonus]) if idx_bonus >= 0 else '',
                'years at company': row[idx_years_at_company] if idx_years_at_company >= 0 else '',
                'years of experience': row[idx_years_exp] if idx_years_exp >= 0 else '',
            }]
        # Range case
        elif 'lower bound' in header and 'upper bound' in header:
            idx_lower = header.index('lower bound')
            idx_upper = header.index('upper bound')
            row = rows[0] if rows else []
            def parse_money(s):
                return parse_usd(s)
            lower = parse_money(row[idx_lower]) if idx_lower >= 0 and row[idx_lower] else None
            upper = parse_money(row[idx_upper]) if idx_upper >= 0 and row[idx_upper] else None
            avg = ''
            if lower and upper:
                try:
                    avg = str(int((int(lower)+int(upper))/2))
                except Exception:
                    avg = ''
            return [{
                'role name': role_folder_name,
                'role rank': '',
                'role level': '',
                'total pay (USD)': avg,
                'lower bound (USD)': lower if lower else '',
                'upper bound (USD)': upper if upper else '',
            }]
        else:
            return []

# Parse benefits.csv for a company
def parse_benefits_csv(path):
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        out = []
        for row in reader:
            cat = row.get('benefit_category', '').strip()
            ben = row.get('benefit', '').strip()
            if not cat and not ben:
                continue
            out.append({'benefit category': cat, 'benefit': ben})
        return out


def main():
    parser = argparse.ArgumentParser(description='Combine all role salary CSVs and benefits CSVs into unified outputs')
    parser.add_argument('root', help='Root folder to search for company data')
    args = parser.parse_args()

    # Read company info
    company_info = read_company_info(os.path.join(os.path.dirname(__file__), 'nasdaq_100_levels.csv'))

    # Combine salaries
    all_rows = []
    # Combine benefits
    all_benefits = []

    for company in os.listdir(args.root):
        company_dir = os.path.join(args.root, company)
        if not os.path.isdir(company_dir):
            continue
        # Salaries under role subfolders
        for role in os.listdir(company_dir):
            role_dir = os.path.join(company_dir, role)
            if not os.path.isdir(role_dir):
                continue
            csv_path = os.path.join(role_dir, f'{role}.csv')
            if not os.path.isfile(csv_path):
                continue
            parsed = parse_salary_csv(csv_path, role)
            for row in parsed:
                out_row = {col: '' for col in OUTPUT_COLS}
                cslug = company.strip().lower().replace(' ', '-')
                cinfo = company_info.get(cslug, {})
                out_row['company name'] = cinfo.get('company name', company)
                out_row['company ticker'] = cinfo.get('company ticker', '')
                out_row['company location'] = cinfo.get('company location', '')
                for k, v in row.items():
                    if k in out_row:
                        out_row[k] = v
                all_rows.append(out_row)
        # Benefits at company root
        benefits_path = os.path.join(company_dir, 'benefits.csv')
        if os.path.isfile(benefits_path):
            parsed_b = parse_benefits_csv(benefits_path)
            cslug = company.strip().lower().replace(' ', '-')
            cinfo = company_info.get(cslug, {})
            for row in parsed_b:
                out_b = {col: '' for col in BENEFIT_OUTPUT_COLS}
                out_b['company name'] = cinfo.get('company name', company)
                out_b['company ticker'] = cinfo.get('company ticker', '')
                out_b['company location'] = cinfo.get('company location', '')
                out_b['benefit category'] = row.get('benefit category', '')
                out_b['benefit'] = row.get('benefit', '')
                all_benefits.append(out_b)

    # Write outputs
    with open('salaries.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLS)
        writer.writeheader()
        writer.writerows(all_rows)

    with open('benefits.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=BENEFIT_OUTPUT_COLS)
        writer.writeheader()
        writer.writerows(all_benefits)

if __name__ == '__main__':
    main()
