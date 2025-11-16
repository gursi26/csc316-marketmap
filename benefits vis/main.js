// ==== CONFIG ====
const BENEFITS_CSV = "dataset/cleaned/Company-benefits.csv"; // update if needed
const LOGO_ROOT = "dataset/logos/images";                     // logo folder
const LOGO_EXT = ".png";                                     // change to .svg/.jpg if needed

// ==== DOM ====
const selectEl = document.getElementById("bc-company-select");
const summaryEl = document.getElementById("bc-summary");
const trackEl = document.querySelector(".bc-track");
const tooltipEl = document.getElementById("bc-tooltip");
const logoImg = document.getElementById("bc-company-logo");

// screen navigation
const btnLeft = document.querySelector(".bc-nav-left");
const btnRight = document.querySelector(".bc-nav-right");

let currentScreen = 0;
const NUM_SCREENS = 4;

let allBenefits = [];
let uniqueByTicker = new Map(); // ticker -> array of unique benefits

// ==== HELPERS ====

function logoUrl(ticker) {
  // You can change this if your filenames differ
  return `${LOGO_ROOT}/${ticker}.png`;
}

function showTooltip(html, event) {
  tooltipEl.innerHTML = html;
  tooltipEl.classList.remove("hidden");
  const padding = 10;
  tooltipEl.style.left = event.pageX + padding + "px";
  tooltipEl.style.top = event.pageY - padding + "px";
}

function hideTooltip() {
  tooltipEl.classList.add("hidden");
}

function goToScreen(idx) {
  currentScreen = (idx + NUM_SCREENS) % NUM_SCREENS;
  const offset = currentScreen * 100;
  trackEl.style.transform = `translateX(-${offset}%)`;
}

// simple keyword match (description only, to keep logic easy to tune)
function filterByKeywords(arr, keywords) {
  const kws = keywords.map(k => k.toLowerCase());
  return arr.filter(d => {
    const text = (d["Benefit Description"] || "").toLowerCase();
    return kws.some(k => text.includes(k));
  });
}

// category AND keyword helper (for some cards where we want tighter match)
function filterByCategoryAndKeywords(arr, categoryList, keywords = []) {
  const cats = new Set(categoryList.map(c => c.toLowerCase()));
  const kws = keywords.map(k => k.toLowerCase());
  return arr.filter(d => {
    const cat = (d["Benefit Category"] || "").toLowerCase();
    if (!cats.has(cat)) return false;
    if (!kws.length) return true;
    const text = (d["Benefit Description"] || "").toLowerCase();
    return kws.some(k => text.includes(k));
  });
}

function setCount(cardId, count) {
  const el = document.querySelector(`#${cardId} .bc-count`);
  if (el) el.textContent = count ? `${count} benefit${count !== 1 ? "s" : ""}` : "0 benefits";
}

// ==== MAIN UPDATE LOGIC ====

function updateForCompany(ticker) {
  const subset = allBenefits.filter(d => d.Ticker === ticker);

  // precompute lowercased descriptions
  subset.forEach(d => {
    d._desc = (d["Benefit Description"] || "").toLowerCase();
    d._cat = (d["Benefit Category"] || "").toLowerCase();
  });

  const totalBenefits = subset.length;
  const categories = new Set(subset.map(d => d["Benefit Category"]));
  summaryEl.textContent = `${ticker} offers ${totalBenefits} benefits across ${categories.size} categories.`;

  // ---- OFFICE SCREEN ----

  // fitness: gym, fitness, wellness classes
  const officeFitness = filterByKeywords(subset, [
    "gym",
    "fitness",
    "wellness",
    "yoga",
    "exercise",
    "workout"
  ]);

  // food & drink
  const officeFood = filterByKeywords(subset, [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "snacks",
    "drinks",
    "drink",
    "coffee",
    "food",
    "meal",
    "juice"
  ]);

  // learning/tuition
  const officeLearn = filterByKeywords(subset, [
    "tuition",
    "learning and development",
    "learning",
    "development",
    "course",
    "training"
  ]);

  // phone
  const officePhone = filterByKeywords(subset, [
    "phone bill reimbursement",
    "phone bill",
    "company phones",
    "phones"
  ]);

  // workspace-ish: custom workstation, on-site laundry/mall/etc
  const officeWorkspace = filterByKeywords(subset, [
    "custom work station",
    "on-site laundry",
    "on-site employee mall",
    "on-site car wash",
    "on-site tire replacement"
  ]);

  setCount("office-fitness", officeFitness.length);
  setCount("office-food", officeFood.length);
  setCount("office-learning", officeLearn.length);
  setCount("office-phone", officePhone.length);
  setCount("office-workspace", officeWorkspace.length);

  // ---- VENDING SCREEN (food-heavy) ----
  const vendingFood = officeFood; // reuse
  const vendingOther = subset.filter(
    d => vendingFood.includes(d) && !d["Benefit Description"].toLowerCase().includes("snack")
  );

  setCount("vending-food", vendingFood.length);
  setCount("vending-other", vendingOther.length);

  // ---- SHIELD SCREEN (insurance/protection) ----
  const healthDental = filterByCategoryAndKeywords(
    subset,
    ['Insurance, Health, & Wellness'],
    ["health insurance", "dental", "vision", "hsa", "fsa"]
  );

  const lifeDisability = filterByKeywords(subset, [
    "life insurance",
    "disability insurance",
    "accidental death and dismemberment",
    "ad&d"
  ]);

  const petExtra = filterByKeywords(subset, [
    "pet insurance",
    "accident insurance",
    "auto and home insurance",
    "business travel and accident insurance",
    "bta", // just in case
    "serious injury"
  ]);

  const familyIns = filterByKeywords(subset, [
    "maternity leave",
    "paternity leave",
    "fertility assistance",
    "surrogacy assistance",
    "child care",
    "childcare",
    "babysitting",
    "baby"
  ]);

  setCount("shield-health", healthDental.length);
  setCount("shield-life", lifeDisability.length);
  setCount("shield-pet", petExtra.length);
  setCount("shield-family", familyIns.length);

  // ---- ROAD SCREEN ----
  const transport = filterByKeywords(subset, [
    "transport allowance",
    "regional transit system",
    "transit",
    "shuttle",
    "company shuttle",
    "bikes on campus",
    "bike"
  ]);

  const childcareRoad = familyIns; // same underlying idea
  const remoteFlex = filterByKeywords(subset, [
    "remote work",
    "relocation bonus",
    "housing stipend"
  ]);

  setCount("road-transport", transport.length);
  setCount("road-childcare", childcareRoad.length);
  setCount("road-remote", remoteFlex.length);

  // ---- LOGO + UNIQUE BENEFITS TOOLTIP ----
  logoImg.src = logoUrl(ticker);
  const uniqueList = uniqueByTicker.get(ticker) || [];

  if (uniqueList.length) {
    logoImg.style.opacity = "1";
    logoImg.onmousemove = e => {
      const items = uniqueList
        .map(d => `• ${d["Benefit Description"]}`)
        .join("<br>");
      showTooltip(`<strong>Unique to ${ticker}</strong>${items ? "<br>" + items : ""}`, e);
    };
    logoImg.onmouseleave = hideTooltip;
  } else {
    // still show logo, but no special tooltip
    logoImg.style.opacity = "0.7";
    logoImg.onmousemove = () => {};
    logoImg.onmouseleave = () => {};
  }
}

// ==== INIT ====

d3.csv(BENEFITS_CSV).then(data => {
  // clean
  data.forEach(d => {
    d.Ticker = (d.Ticker || "").trim();
    d["Benefit Category"] = (d["Benefit Category"] || "").trim();
    d["Benefit Description"] = (d["Benefit Description"] || "").trim();
  });

  allBenefits = data;

  // build ticker list
  const tickers = Array.from(new Set(data.map(d => d.Ticker))).sort();
  tickers.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    selectEl.appendChild(opt);
  });

  // precompute unique benefits per ticker
  const uniqueMap = new Map();
  data.forEach(d => {
    const cat = d["Benefit Category"] || "";
    if (cat.toLowerCase().startsWith("unique to")) {
      if (!uniqueMap.has(d.Ticker)) uniqueMap.set(d.Ticker, []);
      uniqueMap.get(d.Ticker).push(d);
    }
  });
  uniqueByTicker = uniqueMap;

  const initialTicker = tickers[0];
  selectEl.value = initialTicker;
  updateForCompany(initialTicker);

  selectEl.addEventListener("change", () => {
    updateForCompany(selectEl.value);
  });

  // nav buttons
  btnLeft.addEventListener("click", () => goToScreen(currentScreen - 1));
  btnRight.addEventListener("click", () => goToScreen(currentScreen + 1));

  // optional: keyboard left/right
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") goToScreen(currentScreen - 1);
    if (e.key === "ArrowRight") goToScreen(currentScreen + 1);
  });
});
