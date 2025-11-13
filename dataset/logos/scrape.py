import requests
import os
import csv
from dotenv import load_dotenv

load_dotenv()
LOGO_DEV_PUBLIC_KEY = os.getenv('LOGO_DEV_PUBLIC_KEY')
save_to = "./images/{ticker}.png"


def get_company_logo(ticker):
    url = f"https://img.logo.dev/ticker/{ticker}?token={LOGO_DEV_PUBLIC_KEY}"
    response = requests.get(url)
    return response.content


def main():
    # Create images directory if it doesn't exist
    os.makedirs("./images", exist_ok=True)
    
    # Read the CSV file
    csv_path = "../cleaned/Company-info.csv"
    with open(csv_path, 'r') as csvfile:
        reader = csv.DictReader(csvfile)
        
        for row in reader:
            ticker = row['Ticker']
            print(f"Downloading logo for {ticker}...")
            
            try:
                # Get the logo
                logo_content = get_company_logo(ticker)
                
                # Save to file
                output_path = save_to.format(ticker=ticker)
                with open(output_path, 'wb') as img_file:
                    img_file.write(logo_content)
                    
                print(f"  ✓ Saved {ticker} logo to {output_path}")
            except Exception as e:
                print(f"  ✗ Error downloading {ticker}: {e}")


if __name__ == "__main__":
    main()