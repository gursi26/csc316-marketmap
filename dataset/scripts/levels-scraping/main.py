# scrape_levels_roles_and_tables.py
# High-level:
# - CLI taking company and --limit (number of roles) and --exists (existence check mode).
# - If --exists: open company salaries page, detect 404 banner, exit 0/1 accordingly.
# - Else: collect role links from the company page, visit each role page,
#   expand the salary table, scrape it, and save CSV under:
#   data/<company>/<role>/<role>.csv
# - Browser is visible (headless=False). All paths/directories are created as needed.

import asyncio
import argparse
import csv
import json
import os
import re
import sys
from urllib.parse import urljoin, urlparse
from playwright.async_api import async_playwright, TimeoutError as PWTimeoutError

# ---------- Selectors ----------
SEL_CONTAINER = "div.MuiGrid-root.MuiGrid-container.css-1u20msc"
SEL_ITEMS = f"{SEL_CONTAINER} > div"
SEL_TABLE = "table.MuiTable-root.css-1f6fkxk"
# The "show more" control right under the table (anchor with button classes)
SEL_BTN_CSS = ("a.MuiButtonBase-root.MuiButton-root.MuiButton-text.MuiButton-textNeutral."
               "MuiButton-sizeLarge.MuiButton-textSizeLarge.MuiButton-colorNeutral.css-y5b368")
# 404 marker on invalid company pages
SEL_404 = "h3.MuiTypography-root.MuiTypography-h3.error_errorTitle__kVLKx.css-ydbnqp"

# ---------- Utils ----------
def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^\w\-]+", "-", s)
    s = re.sub(r"-{2,}", "-", s)
    return s.strip("-")

async def is_404(page) -> bool:
    """Detect the '404. Oops!' marker."""
    try:
        el = page.locator(SEL_404)
        return await el.is_visible()
    except Exception:
        return False

async def set_currency_to_usd(page):
    """
    Click the currency button at the top, then select USD in the modal.
    If the USD button is not found, print an error and exit.
    Before opening the modal, check if the currency button already shows USD and skip if so.
    """
    try:
        # Wait for currency button
        await page.wait_for_selector('button.button_currencyButton__g_Vnw', timeout=10000)
        btn = page.locator('button.button_currencyButton__g_Vnw').first
        # Short-circuit if already USD
        try:
            btn_text = (await btn.inner_text()).upper()
            if 'USD' in btn_text:
                return
        except Exception:
            pass
        # Click the currency button to open modal
        await btn.click()
        # Wait for the modal list to appear
        await page.wait_for_selector('.currency-locale-selector-modal_listContainer__pGPLo', timeout=10000)
        # Click the button inside the second li (USD)
        usd_button = await page.query_selector('.currency-locale-selector-modal_listContainer__pGPLo li:nth-child(2) button[data-code="USD"]')
        if usd_button:
            await usd_button.click()
            await page.wait_for_timeout(500)  # Give time for modal to close
        else:
            print("ERROR: USD button not found in currency modal.", file=sys.stderr)
            sys.exit(2)
    except Exception as e:
        print(f"Currency set to USD failed: {e}", file=sys.stderr)
        sys.exit(2)

# ---------- Core steps ----------
async def company_exists(page, company: str) -> bool:
    """Navigate to the company salaries page and return True if it exists."""
    base_url = f"https://www.levels.fyi/companies/{company}/salaries"
    await page.goto(base_url, wait_until="domcontentloaded")
    return not (await is_404(page))

async def collect_role_links(page, company: str, limit: int, country_slug: str):
    """
    On the company salaries page:
    - Find role cards under the provided container.
    - For each card, take the first <a>, require 'salaries' in href, and read the <h6> text.
    - Return an ordered dict {role_name: absolute_url}, capped at limit.
    - Append /locations/<country_slug> to each role link.
    """
    base_url = f"https://www.levels.fyi/companies/{company}/salaries"
    await page.goto(base_url, wait_until="domcontentloaded")

    if await is_404(page):
        return None  # invalid company

    await page.wait_for_selector(SEL_ITEMS, timeout=15000)

    origin = urlparse(page.url)._replace(path="", params="", query="", fragment="").geturl()
    items = page.locator(SEL_ITEMS)
    count = await items.count()

    results = {}
    for i in range(count):
        if len(results) >= limit:
            break
        div = items.nth(i)
        a = div.locator("a").first
        if await a.count() == 0:
            continue
        href = await a.get_attribute("href")
        if not href or "salaries" not in href:
            continue
        role_el = a.locator("h6").first
        role_text = (await role_el.inner_text()).strip() if await role_el.count() else ""
        if not role_text:
            continue
        abs_url = urljoin(origin, href)
        abs_url = abs_url.rstrip("/") + f"/locations/{country_slug}"
        if role_text not in results:
            results[role_text] = abs_url

    return results

async def scroll_table_to_top(page):
    """Ensure the salary table is scrolled to the top of the viewport for reliable interaction."""
    tbl = page.locator(SEL_TABLE).first
    await tbl.wait_for(state="visible", timeout=20000)
    await tbl.evaluate("el => el.scrollIntoView({block: 'start', inline: 'nearest'})")
    await page.wait_for_timeout(150)

async def click_expand_button_near_table(page):
    """
    Click the 'show more' control right beneath the table (best-effort).
    Return True if clicked, False otherwise.
    """
    btn = page.locator(SEL_BTN_CSS).first
    if await btn.count():
        await btn.scroll_into_view_if_needed()
        await btn.click()
        await page.wait_for_timeout(600)
        return True

    # Fallback: first following-sibling anchor after table
    table = page.locator(SEL_TABLE).first
    if await table.count():
        rel = table.locator("xpath=following-sibling::a[contains(@class,'MuiButtonBase-root')][1]")
        if await rel.count():
            await rel.scroll_into_view_if_needed()
            await rel.click()
            await page.wait_for_timeout(600)
            return True
    return False

async def scrape_table_to_csv(page, url: str, csv_path: str, log_case: bool = False) -> str:
    """
    On the role page:
    - Load page, scroll table to top, click expand (if present),
      extract headers/body, and save as CSV.
    - If table is missing, detect and parse the median salary box or salary range indicator.
    - Returns: 'table', 'median', 'range', or False
    """
    try:
        await page.goto(url, wait_until="domcontentloaded")
        if await is_404(page):
            return False
        # Try to find the table first
        table_found = await page.locator(SEL_TABLE).count() > 0
        if table_found:
            await page.wait_for_selector(SEL_TABLE, timeout=20000)
            await scroll_table_to_top(page)
            await click_expand_button_near_table(page)   # best-effort expand
            await page.wait_for_selector(SEL_TABLE, timeout=20000)
            # If table was found, continue as before
            table = page.locator(SEL_TABLE).first
            ths = table.locator("thead th")
            headers, start_row = [], 0
            if await ths.count() > 0:
                headers = [ (await ths.nth(i).inner_text()).strip() for i in range(await ths.count()) ]
            else:
                first_row_cells = table.locator("tbody tr").first.locator("td")
                headers = [ (await first_row_cells.nth(i).inner_text()).strip() for i in range(await first_row_cells.count()) ]
                start_row = 1
            rows = []
            trs = table.locator("tbody tr")
            for r in range(start_row, await trs.count()):
                tds = trs.nth(r).locator("td")
                cells = [ (await tds.nth(c).inner_text()).strip() for c in range(await tds.count()) ]
                if cells and any(cells):
                    rows.append(cells)
            os.makedirs(os.path.dirname(csv_path), exist_ok=True)
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                if headers:
                    w.writerow(headers)
                w.writerows(rows)
            return "table"
        else:
            # Check for median salary box
            median_box = page.locator('#company-page_cardContainerId__HLkRd > div > div.MuiBox-root.css-0 > div > div.MuiBox-root.css-xz82th > div')
            if await median_box.count() > 0:
                # Robust extraction: find all .input-text-label and their next sibling
                label_map = {
                    "Total per year": "Total per year",
                    "Base": "Base",
                    "Stock (/yr)": "Stock (/yr)",
                    "Bonus": "Bonus",
                    "Years at company": "Years at company",
                    "Years exp": "Years experience",
                    "Years' experience": "Years experience",
                    "Level": "Level"
                }
                values = {v: "" for v in label_map.values()}
                label_els = await median_box.locator('.input-text-label').all()
                for label_el in label_els:
                    label = (await label_el.inner_text()).strip()
                    mapped = label_map.get(label)
                    if not mapped:
                        continue
                    # Get the next sibling div or span
                    value_el = await label_el.evaluate_handle('el => el.nextElementSibling')
                    value = ""
                    if value_el:
                        try:
                            value = (await value_el.inner_text()).strip()
                        except Exception:
                            value = ""
                    values[mapped] = value
                headers = [
                    "Total per year", "Base", "Stock (/yr)", "Bonus", "Years at company", "Years experience", "Level"
                ]
                row = [values[h] for h in headers]
                os.makedirs(os.path.dirname(csv_path), exist_ok=True)
                with open(csv_path, "w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f)
                    w.writerow(headers)
                    w.writerow(row)
                return "median"
            # Check for salary range indicator
            salary_range = page.locator('#company-page_cardContainerId__HLkRd > div > div.MuiBox-root.css-0 > div > div.job-family_salaryRangeContainer__FbAHC > section > div.salary-range_averageTotalCompensationContainer__Y__qZ > div.salary-range_labelRangeLocationContainer__3Ica0 > div.salary-range_rangeDisplay__0Q91Z')
            if await salary_range.count() > 0:
                # Extract lower and upper bound from the spans
                spans = await salary_range.locator('span').all()
                lower, upper = "", ""
                if len(spans) >= 3:
                    lower = (await spans[0].inner_text()).strip()
                    upper = (await spans[2].inner_text()).strip()
                headers = ["Lower Bound", "Upper Bound"]
                row = [lower, upper]
                os.makedirs(os.path.dirname(csv_path), exist_ok=True)
                with open(csv_path, "w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f)
                    w.writerow(headers)
                    w.writerow(row)
                return "range"
            return False
    except PWTimeoutError:
        return False

async def scrape_company_benefits(page, company: str):
    """
    Scrape all benefit categories and their benefits for a company and write to ./data/<company>/benefits.csv
    """
    import csv
    import os
    benefits_url = f"https://www.levels.fyi/companies/{company}/benefits"
    await page.goto(benefits_url, wait_until="domcontentloaded")
    await page.wait_for_timeout(1000)  # Give time for page to load

    # Find all benefit category headers
    category_headers = await page.locator('h6.benefits_categoryHeader__h8XLz').all()
    results = []
    for header in category_headers:
        category = (await header.inner_text()).strip()
        # The next sibling div contains the list of benefits
        # Use XPath to get the following sibling div
        benefit_divs = await header.evaluate_handle('el => el.nextElementSibling?.querySelectorAll("div.MuiGrid-root.MuiGrid-item")')
        if benefit_divs:
            # benefit_divs is a NodeList, need to iterate
            benefit_handles = await benefit_divs.get_properties()
            for bh in benefit_handles.values():
                # Find the benefit label inside this div
                label_el = await bh.query_selector('a.benefits_benefitLabel__qNs7Y')
                if label_el:
                    benefit = (await label_el.inner_text()).strip()
                    results.append({"benefit_category": category, "benefit": benefit})
                else:
                    # fallback: try to get text from span inside
                    span_el = await bh.query_selector('span.MuiTypography-root')
                    if span_el:
                        benefit = (await span_el.inner_text()).strip()
                        results.append({"benefit_category": category, "benefit": benefit})
    # Write to CSV
    out_dir = os.path.join("data", company)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "benefits.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["benefit_category", "benefit"])
        writer.writeheader()
        writer.writerows(results)

# ---------- Entrypoint ----------
async def main():
    parser = argparse.ArgumentParser(description="Scrape Levels.fyi role tables to CSV, or just check if a company exists.")
    parser.add_argument("company", help="Company slug (e.g., 'shopify')")
    parser.add_argument("country", help="Country name (e.g., 'canada', 'united states')")
    parser.add_argument("--limit", type=int, default=10, help="Max number of role links to process")
    parser.add_argument("--exists", action="store_true", help="Only verify the company page exists; exit 0/1 accordingly")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode (default: False)")
    args = parser.parse_args()

    country_slug = slugify(args.country)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=args.headless)
        context = await browser.new_context(viewport={"width": 1400, "height": 1000}, device_scale_factor=2)
        page = await context.new_page()

        try:
            # --exists short-circuit: validate and exit
            if args.exists:
                ok = await company_exists(page, args.company)
                await browser.close()
                if ok:
                    print(f"Company '{args.company}' exists on levels.fyi.")
                    sys.exit(0)
                else:
                    print(f"Invalid company '{args.company}'. 404 page detected.", file=sys.stderr)
                    sys.exit(1)

            # Set currency to USD (only once per script run, before scraping)
            base_url = f"https://www.levels.fyi/companies/{args.company}/salaries"
            await page.goto(base_url, wait_until="domcontentloaded")
            await set_currency_to_usd(page)

            # Normal scraping flow
            roles = await collect_role_links(page, args.company, args.limit, country_slug)
            if roles is None:
                print(f"Invalid company '{args.company}'. 404 page detected.", file=sys.stderr)
                await browser.close()
                sys.exit(1)

            print(json.dumps(roles, indent=2, ensure_ascii=False))

            saved = []
            role_list = list(roles.items())
            total_roles = len(role_list)
            for idx, (role, link) in enumerate(role_list):
                print(f"\nScraping role {idx+1}/{total_roles}: {role}")
                print(f"Link: {link}")
                try:
                    result = await scrape_table_to_csv(page, link, os.path.join(f"data/{args.company}/{slugify(role)}", f"{slugify(role)}.csv"), log_case=True)
                    if result == "table":
                        print("Detected: table present.")
                    elif result == "median":
                        print("Detected: median salary box element present.")
                    elif result == "range":
                        print("Detected: salary range indicator element present.")
                    else:
                        print("Detected: no table, median salary box, or salary range indicator found.")
                    if result == "table":
                        saved.append(link)
                    elif result is False:
                        print(f"  Failed to scrape role: {role}", file=sys.stderr)
                except Exception as e:
                    print(f"  Exception scraping role {role}: {e}", file=sys.stderr)
                    continue

            # Scrape company benefits after roles
            await scrape_company_benefits(page, args.company)

        finally:
            # Graceful shutdown
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
