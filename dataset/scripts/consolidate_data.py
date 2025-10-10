#!/usr/bin/env python3
"""
Data consolidation script for NASDAQ 100 market data.
Reads multiple CSV files and outputs consolidated datasets.
"""

import pandas as pd
from pathlib import Path

# Define base paths
BASE_DIR = Path(__file__).parent
DATASET_DIR = BASE_DIR / "dataset"
LEVELS_DIR = DATASET_DIR / "levels"
OUTPUT_DIR = BASE_DIR / "consolidated_data"

# Create output directory if it doesn't exist
OUTPUT_DIR.mkdir(exist_ok=True)

def clean_ceo_approval(value):
    """Extract percentage from CEO approval string."""
    if pd.isna(value) or value == 'X% approve of CEO':
        return None
    try:
        return int(value.split('%')[0])
    except:
        return None

def clean_company_type(value):
    """Extract company type (Public/Private) from full string."""
    if pd.isna(value):
        return None
    # Extract first word before 'Company'
    # e.g., "Public Company (AAPL)" -> "Public"
    # e.g., "Private Company" -> "Private"
    return value.split()[0] if value else None

def clean_founding_year(value):
    """Replace 0.0 or 0 founding years with None."""
    if pd.isna(value) or value == 0 or value == 0.0:
        return None
    return int(value) if value != 0 else None

def main():
    print("Loading source data files...")
    
    # Load all source CSV files
    nasdaq_snapshot = pd.read_csv(DATASET_DIR / "nasdaq100_snapshot.csv")
    glassdoor = pd.read_csv(DATASET_DIR / "glassdoorData.csv")
    salaries = pd.read_csv(LEVELS_DIR / "salaries.csv")
    benefits = pd.read_csv(LEVELS_DIR / "benefits.csv")
    
    print(f"Loaded {len(nasdaq_snapshot)} rows from nasdaq100_snapshot.csv")
    print(f"Loaded {len(glassdoor)} rows from glassdoorData.csv")
    print(f"Loaded {len(salaries)} rows from salaries.csv")
    print(f"Loaded {len(benefits)} rows from benefits.csv")
    
    # ===================================================================
    # 1. Company-info.csv
    # ===================================================================
    print("\nCreating Company-info.csv...")
    
    # Start with nasdaq snapshot for basic company info (includes State)
    company_info = nasdaq_snapshot[['Ticker', 'Company', 'Address', 'State', 'Sector', 'Industry']].copy()
    
    # Merge with glassdoor data (Symbol -> Ticker) to get Country
    glassdoor_subset = glassdoor[['Symbol', 'CompanyType', 'FoundingYear', 
                                   'Country', 'Rating', 'CEOApprovalPercentage']].copy()
    glassdoor_subset.rename(columns={'Symbol': 'Ticker'}, inplace=True)
    
    company_info = company_info.merge(glassdoor_subset, on='Ticker', how='left')
    
    # Use Full-Time Employees from nasdaq_snapshot (more accurate than glassdoor buckets)
    nasdaq_employees = nasdaq_snapshot[['Ticker', 'Full-Time Employees']].copy()
    company_info = company_info.merge(nasdaq_employees, on='Ticker', how='left')
    
    # Use Full-Time Employees from nasdaq snapshot (not glassdoor buckets)
    company_info['Employee Count'] = company_info['Full-Time Employees']
    
    # Clean CEO approval percentage
    company_info['CEO Approval Percentage'] = company_info['CEOApprovalPercentage'].apply(clean_ceo_approval)
    
    # Clean company type to show only 'Public', 'Private', etc.
    company_info['CompanyType'] = company_info['CompanyType'].apply(clean_company_type)
    
    # Clean founding year (replace 0.0 with None)
    company_info['FoundingYear'] = company_info['FoundingYear'].apply(clean_founding_year)
    
    # Convert to int to avoid float representation (1998.0 -> 1998)
    company_info['FoundingYear'] = company_info['FoundingYear'].astype('Int64')  # nullable int
    company_info['CEO Approval Percentage'] = company_info['CEO Approval Percentage'].astype('Int64')  # nullable int
    
    # Rename and select final columns
    company_info_final = company_info[[
        'Ticker',
        'Company',
        'Address',
        'Country',
        'State',
        'CompanyType',
        'Sector',
        'Industry',
        'FoundingYear',
        'Employee Count',
        'Rating',
        'CEO Approval Percentage'
    ]].copy()
    
    company_info_final.columns = [
        'Ticker',
        'Name',
        'Address',
        'Country',
        'State',
        'Company Type',
        'Sector',
        'Industry',
        'Founding Year',
        'Employee Count',
        'Employee Rating',
        'CEO Approval Percentage'
    ]
    
    company_info_final.to_csv(OUTPUT_DIR / "Company-info.csv", index=False)
    print(f"✓ Created Company-info.csv with {len(company_info_final)} rows")
    
    # ===================================================================
    # 2. Company-financials.csv
    # ===================================================================
    print("\nCreating Company-financials.csv...")
    
    company_financials = nasdaq_snapshot[[
        'Ticker',
        'Market Cap',
        'Total Revenue',
        'Net Profit (TTM)',
        'Dividend Yield',
        'Dividend Rate',
        'Trailing PE',
        'Forward PE'
    ]].copy()
    
    company_financials.columns = [
        'Ticker',
        'Market Cap',
        'Total Revenue',
        'Net Profit TTM',
        'Dividend Yield',
        'Dividend Rate',
        'Trailing PE',
        'Forward PE'
    ]
    
    company_financials.to_csv(OUTPUT_DIR / "Company-financials.csv", index=False)
    print(f"✓ Created Company-financials.csv with {len(company_financials)} rows")
    
    # ===================================================================
    # 3. Company-salary.csv
    # ===================================================================
    print("\nCreating Company-salary.csv...")
    
    company_salary = salaries[[
        'company ticker',
        'role name',
        'role rank',
        'role level',
        'total pay (USD)',
        'base pay (USD)',
        'stock (USD)',
        'bonus (USD)'
    ]].copy()
    
    company_salary.columns = [
        'Ticker',
        'Role Name',
        'Role Rank',
        'Role Rank Name',
        'Total Pay',
        'Base Pay',
        'Stock',
        'Bonus'
    ]
    
    # Convert ticker to uppercase for consistency
    company_salary['Ticker'] = company_salary['Ticker'].str.upper()
    
    # Convert Role Rank to int to avoid float representation
    company_salary['Role Rank'] = company_salary['Role Rank'].astype('Int64')  # nullable int
    
    company_salary.to_csv(OUTPUT_DIR / "Company-salary.csv", index=False)
    print(f"✓ Created Company-salary.csv with {len(company_salary)} rows")
    
    # ===================================================================
    # 4. Company-benefits.csv
    # ===================================================================
    print("\nCreating Company-benefits.csv...")
    
    company_benefits = benefits[[
        'company ticker',
        'benefit category',
        'benefit'
    ]].copy()
    
    company_benefits.columns = [
        'Ticker',
        'Benefit Category',
        'Benefit Description'
    ]
    
    # Convert ticker to uppercase for consistency
    company_benefits['Ticker'] = company_benefits['Ticker'].str.upper()
    
    company_benefits.to_csv(OUTPUT_DIR / "Company-benefits.csv", index=False)
    print(f"✓ Created Company-benefits.csv with {len(company_benefits)} rows")
    
    # ===================================================================
    # Summary
    # ===================================================================
    print("\n" + "="*60)
    print("Data consolidation complete!")
    print("="*60)
    print(f"\nOutput directory: {OUTPUT_DIR}")
    print("\nGenerated files:")
    print(f"  1. Company-info.csv       ({len(company_info_final)} companies)")
    print(f"  2. Company-financials.csv ({len(company_financials)} companies)")
    print(f"  3. Company-salary.csv     ({len(company_salary)} salary records)")
    print(f"  4. Company-benefits.csv   ({len(company_benefits)} benefit records)")
    print("\nNote: Company-sentiment.csv skipped (WIP)")
    print("="*60)

if __name__ == "__main__":
    main()

