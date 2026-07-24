import os
import urllib.request
import csv
import json
import random
from datetime import datetime

CSV_URL = "https://raw.githubusercontent.com/ine-rmotr-curriculum/FreeCodeCamp-Pandas-Real-Life-Example/master/data/sales_data.csv"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "sales_data.json")

def download_and_process():
    print(f"Downloading dataset from {CSV_URL}...")
    try:
        req = urllib.request.Request(CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            csv_content = response.read().decode('utf-8')
    except Exception as e:
        print(f"Error downloading data: {e}")
        return

    print("Parsing CSV...")
    reader = csv.DictReader(csv_content.splitlines())
    records = []
    
    for row in reader:
        try:
            # Parse metrics as appropriate types
            record = {
                "Date": row.get("Date", "").strip(),
                "Day": int(row.get("Day", 0)),
                "Month": row.get("Month", "").strip(),
                "Year": int(row.get("Year", 0)),
                "Customer_Age": int(row.get("Customer_Age", 0)),
                "Age_Group": row.get("Age_Group", "").strip(),
                "Customer_Gender": row.get("Customer_Gender", "").strip(),
                "Country": row.get("Country", "").strip(),
                "State": row.get("State", "").strip(),
                "Product_Category": row.get("Product_Category", "").strip(),
                "Sub_Category": row.get("Sub_Category", "").strip(),
                "Product": row.get("Product", "").strip(),
                "Order_Quantity": int(row.get("Order_Quantity", 0)),
                "Unit_Cost": float(row.get("Unit_Cost", 0)),
                "Unit_Price": float(row.get("Unit_Price", 0)),
                "Profit": float(row.get("Profit", 0)),
                "Cost": float(row.get("Cost", 0)),
                "Revenue": float(row.get("Revenue", 0))
            }
            records.append(record)
        except Exception as ex:
            # Skip invalid lines
            continue
            
    print(f"Successfully parsed {len(records)} records.")
    
    # Sample records if they are large
    sample_size = min(5000, len(records))
    print(f"Sampling {sample_size} records to optimize performance...")
    
    # We want a representative sample across the dates, so let's do a systematic sample or random sample
    # Random seed for reproducibility
    random.seed(42)
    sampled_records = random.sample(records, sample_size)
    
    # Sort by date so they are chronological
    def get_date(rec):
        try:
            return datetime.strptime(rec["Date"], "%Y-%m-%d")
        except:
            return datetime.min
            
    sampled_records.sort(key=get_date)
    
    # Write to file
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(sampled_records, f, indent=2, ensure_ascii=False)
        
    print("Done! Preprocessing complete.")

if __name__ == "__main__":
    download_and_process()
