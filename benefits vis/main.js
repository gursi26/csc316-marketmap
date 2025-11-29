let currentScreen = 0;
const totalScreens = 5; // now 5 screens

const SCREEN_TITLES = [
  "General Work Benefits",
  "Transportation Benefits",
  "Food Benefits",
  "Insurance Benefits",
  "Additional Benefits"
];

window.addEventListener("DOMContentLoaded", () => {
    const screenTitleEl = document.getElementById("screenTitle");
    screenTitleEl.textContent = SCREEN_TITLES[0];
});


const track = document.querySelector(".track");

// Touch/swipe variables
let touchStartX = 0;
let touchEndX = 0;
let isDragging = false;

// Mouse drag variables
let mouseStartX = 0;
let mouseEndX = 0;
let isMouseDragging = false;

const benefitDescriptions = {};

// Friendly labels for tooltip titles
const FRIENDLY_LABELS = {
  // GYM
  "gym1": "Gym Access — Level 1",
  "gym2": "Gym Access — Level 2",
  "gym3": "Gym Access — Level 3",

  // CHILD
  "child1": "Child Benefits — Level 1",
  "child2": "Child Benefits — Level 2",
  "child3": "Child Benefits — Level 3",

  // RETIREMENT
  "roth1": "Retirement Benefits — Level 1",
  "roth2": "Retirement Benefits — Level 2",
  "roth3": "Retirement Benefits — Level 3",

  // PHONE (renamed category label only)
  "phone1": "Phone Benefits — Level 1",
  "phone2": "Phone Benefits — Level 2",

  // Office / HR
  "healthbenefits1": "Health Benefits — Level 1",
  "healthbenefits2": "Health Benefits — Level 2",
  "pto": "Paid Time Off",
  "sickdays": "Sick Days",
  "clinic": "Clinic", // legacy (not used now, just in case)
  "tuition": "Tuition Support",
  "pet friendly WORKPLACE": "Pet-Friendly Workplace",

  // FOOD
  "breakfast": "Breakfast",
  "lunch": "Lunch",
  "dinner": "Dinner",
  "snack": "Snacks",
  "drink": "Drinks",

  // INSURANCE
  "life": "Life Insurance",
  "vision": "Vision Coverage",
  "dental": "Dental Insurance",
  "health": "Health Insurance",
  "disability": "Disability Insurance",
  "AD&D": "AD&D Coverage",
  "pet insurance": "Pet Insurance",
  "business travel": "Business Travel Insurance",

  // TRANSPORT
  "transit": "Transit Perks",
  "transport": "Transport Benefits",
  "bike": "Bike Program",
  "shuttle": "Shuttle Service"
};

function goToScreen(index) {
  if (index < 0) index = 0;
  if (index >= totalScreens) index = totalScreens - 1;

  currentScreen = index;
  track.style.transform = `translateX(-${currentScreen * 100}vw)`;

  document.getElementById("screenTitle").textContent =
    SCREEN_TITLES[currentScreen];
}



// Button listeners
document.getElementById("nextBtn").addEventListener("click", () => {
  goToScreen(currentScreen + 1);
});

document.getElementById("prevBtn").addEventListener("click", () => {
  goToScreen(currentScreen - 1);
});

// Touch event handlers for swipe
track.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  isDragging = true;
}, { passive: true });

track.addEventListener("touchmove", (e) => {
  if (!isDragging) return;
  touchEndX = e.touches[0].clientX;
}, { passive: true });

track.addEventListener("touchend", () => {
  if (!isDragging) return;
  isDragging = false;

  const swipeThreshold = 50;
  const diff = touchStartX - touchEndX;

  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      goToScreen(currentScreen + 1);
    } else {
      goToScreen(currentScreen - 1);
    }
  }

  touchStartX = 0;
  touchEndX = 0;
});

// Mouse drag support
// track.addEventListener("mousedown", (e) => {
//   mouseStartX = e.clientX;
//   isMouseDragging = true;
//   track.style.cursor = "grabbing";
// });

// track.addEventListener("mousemove", (e) => {
//   if (!isMouseDragging) return;
//   mouseEndX = e.clientX;
// });

// track.addEventListener("mouseup", () => {
//   if (!isMouseDragging) return;
//   isMouseDragging = false;
//   track.style.cursor = "grab";

//   const swipeThreshold = 50;
//   const diff = mouseStartX - mouseEndX;

//   if (Math.abs(diff) > swipeThreshold) {
//     if (diff > 0) {
//       goToScreen(currentScreen + 1);
//     } else {
//       goToScreen(currentScreen - 1);
//     }
//   }

//   mouseStartX = 0;
//   mouseEndX = 0;
// });

track.addEventListener("mouseleave", () => {
  if (isMouseDragging) {
    isMouseDragging = false;
    track.style.cursor = "grab";
  }
});

// Set cursor style
track.style.cursor = "grab";

// Arrow keys for navigation
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") goToScreen(currentScreen + 1);
  if (e.key === "ArrowLeft") goToScreen(currentScreen - 1);
});


/* ============================================================
   DATA CLASSIFICATION
   ============================================================ */

let benefitData = {};
let currentCompany = null;

// Beeswarm globals
let highlightedTicker = null;   // currently locked/highlighted in beeswarm
let dropdownSelected = null;    // ticker selected in dropdown
let hoverEnabled = true;        // hover tooltips enabled only when no highlight

let beeswarmNodes = null;       // d3 selection of logo nodes
let beeswarmDataGlobal = null;  // raw data used in beeswarm
let beeswarmXScale = null;      // x scale for extra benefits
const BEE_ENLARGE = 2; // how much logos enlarge on hover / selection



// D3 utility: bring element to front (SVG has no z-index)
d3.selection.prototype.moveToFront = function() {
  return this.each(function() {
    this.parentNode.appendChild(this);
  });
};



// OFFICE / HR KEYWORDS
const officeKeywords = {
  gym: ["gym", "fitness"],
  child: ["maternity", "fertility", "paternity", "mother", "adoption"],
  roth: ["401", "roth", "espp", "fsa"],
  phone: ["phone"],
  tuition: ["tuition", "learning"],
  healthbenefits: ["clinic", "hsa"],         // NEW counted health benefits
  petwork: ["pet friendly workplace"],
  pto: ["vacation"],                         // NEW Paid Time Off
  sickdays: ["sick"]                         // NEW Sick Days
};

// FOOD
const foodKeywords = {
  breakfast: ["breakfast"],
  lunch: ["lunch"],
  dinner: ["dinner"],
  snack: ["snack"],
  drink: ["drink"]
};

// INSURANCE
const insuranceKeywords = {
  life: ["life insurance"],
  vision: ["vision"],
  health: ["health insurance"],
  dental: ["dental"],
  disability: ["disability"],
  ADnD: ["ad&d"],
  petins: ["pet insurance"],
  bustravel: ["business travel"]
};

// TRANSPORT
const transportKeywords = {
  transit: ["transit"],
  transport: ["transport"],
  bike: ["bike"],
  shuttle: ["shuttle"]
};

// COUNT-BASED ICON RESOLUTION (gym, child, roth)
function resolveCountedIcon(count, base) {
  if (count >= 3) return `${base}3`;
  if (count === 2) return `${base}2`;
  if (count === 1) return `${base}1`;
  return null;
}

// SPECIAL RESOLUTION for Health Benefits (only levels 1–2)
function resolveHealthBenefitsIcon(count) {
  if (count >= 2) return "healthbenefits2";
  if (count === 1) return "healthbenefits1";
  return null;
}

/**
 * CLASSIFY COMPANY ROWS INTO ICONS + STORE UNCATEGORIZED BENEFITS
 */
function classifyCompany(rows) {

  let descStore = {
    gym: [],
    child: [],
    roth: [],
    phone: [],
    tuition: [],
    healthbenefits: [],
    petwork: [],
    pto: [],
    sickdays: [],

    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    drink: [],

    life: [],
    vision: [],
    health: [],
    dental: [],
    disability: [],
    ADnD: [],
    petins: [],
    bustravel: [],

    transit: [],
    transport: [],
    bike: [],
    shuttle: []
  };

  const counts = {
    gym: 0,
    child: 0,
    roth: 0,
    phone: 0,
    healthbenefits: 0
  };

  let icons = {
    gym: null,
    child: null,
    roth: null,
    phone: null,
    healthbenefits: null,  // NEW counted category

    tuition: false,
    petwork: false,
    pto: false,
    sickdays: false,

    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
    drink: false,

    life: false,
    vision: false,
    dental: false,
    health: false,
    disability: false,
    ADnD: false,
    petins: false,
    bustravel: false,

    transit: false,
    transport: false,
    bike: false,
    shuttle: false
  };

  const uncategorized = [];

  rows.forEach(r => {
    const originalDesc = r["Benefit Description"];
    const desc = originalDesc.toLowerCase().trim();

    let matched = false;

    // COUNTED office benefits
    for (let base of ["gym", "child", "roth", "phone", "healthbenefits"]) {
      if (officeKeywords[base] && officeKeywords[base].some(key => desc.includes(key))) {
        counts[base]++;
        descStore[base].push(originalDesc);
        matched = true;
      }
    }

    // Boolean office benefits
    // Tuition
    if (officeKeywords.tuition.some(k => desc.includes(k))) {
      icons.tuition = true;
      descStore.tuition.push(originalDesc);
      matched = true;
    }

    // Pet-friendly workplace
    if (officeKeywords.petwork.some(k => desc.includes(k))) {
      icons.petwork = true;
      descStore.petwork.push(originalDesc);
      matched = true;
    }

    // Paid Time Off
    if (officeKeywords.pto.some(k => desc.includes(k))) {
      icons.pto = true;
      descStore.pto.push(originalDesc);
      matched = true;
    }

    // Sick Days
    if (officeKeywords.sickdays.some(k => desc.includes(k))) {
      icons.sickdays = true;
      descStore.sickdays.push(originalDesc);
      matched = true;
    }

    // FOOD
    for (let f in foodKeywords) {
      if (foodKeywords[f].some(k => desc.includes(k))) {
        icons[f] = true;
        descStore[f].push(originalDesc);
        matched = true;
      }
    }

    // INSURANCE
    for (let iname in insuranceKeywords) {
      if (insuranceKeywords[iname].some(k => desc.includes(k))) {
        icons[iname] = true;
        descStore[iname].push(originalDesc);
        matched = true;
      }
    }

    // TRANSPORT
    for (let tname in transportKeywords) {
      if (transportKeywords[tname].some(k => desc.includes(k))) {
        icons[tname] = true;
        descStore[tname].push(originalDesc);
        matched = true;
      }
    }

    if (!matched) {
      uncategorized.push(originalDesc);
    }
  });

  // Resolve counted icons
  icons.gym = resolveCountedIcon(counts.gym, "gym");
  icons.child = resolveCountedIcon(counts.child, "child");
  icons.roth = resolveCountedIcon(counts.roth, "roth");

  if (counts.phone >= 2) icons.phone = "phone2";
  else if (counts.phone === 1) icons.phone = "phone1";

  // Health benefits: only two levels
  icons.healthbenefits = resolveHealthBenefitsIcon(counts.healthbenefits);

  // MAP FINAL ICON FILENAMES → tooltip store
  for (let key in icons) {
    const iconVal = icons[key];

    if (!iconVal) continue;

    // counted icons (string)
    if (typeof iconVal === "string" && ICON_FILES[iconVal]) {
      benefitDescriptions[ICON_FILES[iconVal]] = descStore[key];
    }

    // boolean icons
    if (iconVal === true && ICON_FILES[key]) {
      benefitDescriptions[ICON_FILES[key]] = descStore[key];
    }
  }

  // Return icons plus uncategorized benefits
  return {
    ...icons,
    uncategorized
  };
}


/* ============================================================
   ICON FILE MAP
   ============================================================ */

const ICON_FILES = {
  "gym1": "gym1.png",
  "gym2": "gym2.png",
  "gym3": "gym3.png",

  "child1": "child1.png",
  "child2": "child2.png",
  "child3": "child3.png",

  "phone1": "phone1.png",
  "phone2": "phone2.png",

  "roth1": "roth1.png",
  "roth2": "roth2.png",
  "roth3": "roth3.png",

  // Health Benefits (replacing clinic)
  "healthbenefits1": "clinic1.png",
  "healthbenefits2": "clinic2.png",

  // Office / HR
  "tuition": "tuition.png",
  "pet friendly WORKPLACE": "pet friendly workplace.png",
  "pto": "vacation.png",    // Paid Time Off
  "sickdays": "sick.png",   // Sick Days

  // Food
  "breakfast": "breakfast.png",
  "lunch": "lunch.png",
  "dinner": "dinner.png",
  "snack": "snack.png",
  "drink": "drink.png",

  // Insurance icons
  "life": "life.svg",
  "vision": "vision.svg",
  "dental": "dental.svg",
  "health": "health.svg",
  "disability": "disability.svg",
  "AD&D": "AD&D.svg",
  "pet insurance": "pet insurance.svg",
  "business travel": "business travel.svg",

  // Transport
  "bike": "bike.png",
  "transit": "transit.png",
  "transport": "transport.png",
  "shuttle": "shuttle.png"
};


/* ============================================================
   ICON POSITION MAP
   (You can tweak these positions manually)
   ============================================================ */

const POSITION_MAP = {
  // ---------- SCREEN 1: OFFICE ----------
  "gym1": { screen: 1, x: 40, y: 82 },
  "gym2": { screen: 1, x: 40, y: 82, rotate: 45, scale: 1 },
  "gym3": { screen: 1, x: 41, y: 83, rotate: -45, scale: 1.4 },

  "child1": { screen: 1, x: 8.2, y: 58, rotate: -45 },
  "child2": { screen: 1, x: 8.5, y: 56, scale: 0.9 },
  "child3": { screen: 1, x: 8.5, y: 55.5 },

  "roth1": { screen: 1, x: 40, y: 42.7, scale: 0.7 },
  "roth2": { screen: 1, x: 40, y: 42, scale: 0.7 },
  "roth3": { screen: 1, x: 40, y: 41.5, scale: 0.8 },

  "phone1": { screen: 1, x: 60, y: 40, scale: 1.2 },
  "phone2": { screen: 1, x: 60, y: 47, scale: 1.2 },

  // Health Benefits (replacing clinic)
  "healthbenefits1": { screen: 1, x: 27, y: 18 },
  "healthbenefits2": { screen: 1, x: 27, y: 18, scale: 1.2 },

  "tuition": { screen: 1, x: 12, y: 22 },
  "pet friendly WORKPLACE": { screen: 1, x: 25, y: 90, scale: 1.5 },

  // NEW: Paid Time Off + Sick Days
  "pto": { screen: 1, x: 50, y: 15, scale: 1.2 },
  "sickdays": { screen: 1, x: 62, y: 22, scale: 1.2 },

  // ---------- SCREEN 2: TRANSPORT ----------
  "transit": { screen: 2, x: 25, y: 80, scale: 2 },
  "transport": { screen: 2, x: 45, y: 65, scale: 2 },
  "bike": { screen: 2, x: 60, y: 55, scale: 1.2 },
  "shuttle": { screen: 2, x: 75, y: 80, scale: 2 },

  // ---------- SCREEN 3: FOOD / VENDING ----------
  "breakfast": { screen: 3, x: 25, y: 31, scale: 2 },
  "lunch": { screen: 3, x: 25, y: 50, scale: 2 },
  "dinner": { screen: 3, x: 25, y: 65, scale: 1.9 },
  "snack": { screen: 3, x: 50, y: 32, scale: 2 },
  "drink": { screen: 3, x: 50, y: 49, scale: 2 },

  // ---------- SCREEN 4: INSURANCE ----------
  "life": { screen: 4, x: 15.7, y: 32 },
  "vision": { screen: 4, x: 71, y: 15 },
  "dental": { screen: 4, x: 84, y: 32 },
  "health": { screen: 4, x: 28, y: 15 },

  "disability": { screen: 4, x: 18, y: 60 },
  "AD&D": { screen: 4, x: 82, y: 60 },

  "pet insurance": { screen: 4, x: 33, y: 84 },
  "business travel": { screen: 4, x: 67, y: 84 }

  // Screen 5 is just the logo, centered via inline style.
};


/* ============================================================
   RENDER ICONS INTO SCREENS
   ============================================================ */

function renderIcons() {
  const ico = benefitData[currentCompany];
  if (!ico) return;

  // Clear all screens
  document.querySelectorAll(".screen-icons").forEach(el => el.innerHTML = "");

  // SCREEN 1 — OFFICE
  if (ico.gym) place(1, ico.gym);
  if (ico.child) place(1, ico.child);
  if (ico.roth) place(1, ico.roth);
  if (ico.phone) place(1, ico.phone);
  if (ico.healthbenefits) place(1, ico.healthbenefits);
  if (ico.tuition) place(1, "tuition");
  if (ico.petwork) place(1, "pet friendly WORKPLACE");
  if (ico.pto) place(1, "pto");
  if (ico.sickdays) place(1, "sickdays");

  // SCREEN 2 — TRANSPORT
  if (ico.transit) place(2, "transit");
  if (ico.transport) place(2, "transport");
  if (ico.bike) place(2, "bike");
  if (ico.shuttle) place(2, "shuttle");

  // SCREEN 3 — FOOD
  if (ico.breakfast) place(3, "breakfast");
  if (ico.lunch) place(3, "lunch");
  if (ico.dinner) place(3, "dinner");
  if (ico.snack) place(3, "snack");
  if (ico.drink) place(3, "drink");

  // SCREEN 4 — INSURANCE
  if (ico.life) place(4, "life");
  if (ico.vision) place(4, "vision");
  if (ico.dental) place(4, "dental");
  if (ico.health) place(4, "health");
  if (ico.disability) place(4, "disability");
  if (ico.ADnD) place(4, "AD&D");
  if (ico.petins) place(4, "pet insurance");
  if (ico.bustravel) place(4, "business travel");

  // SCREEN 5 — COMPANY LOGO + uncategorized benefits
  renderLogo();
}

// Place icon into screens
function place(screenIndex, iconName) {
  if (!iconName) return;

  const target = document.querySelector(`.screen-${screenIndex} .screen-icons`);
  if (!target) return;

  const file = ICON_FILES[iconName];
  if (!file) {
    console.warn("Missing icon mapping for:", iconName);
    return;
  }

  const img = document.createElement("img");
  img.src = `../dataset/Icons/${file}`;
  img.className = "benefitIcon";

  // Positioning
  const pos = POSITION_MAP[iconName];
  if (pos && pos.screen === screenIndex) {
    img.style.position = "absolute";
    img.style.left = pos.x + "%";
    img.style.top = pos.y + "%";

    const angle = pos.rotate ?? 0;
    const scale = pos.scale ?? 1;

    img.style.transform =
      `translate(-50%, -50%) rotate(${angle}deg) scale(${scale})`;
  }

  // Tooltip on hover
  img.addEventListener("mousemove", (e) => {
    const fileName = ICON_FILES[iconName];
    const desc = benefitDescriptions[fileName] || ["No further details available"];
    const label = FRIENDLY_LABELS[iconName] || iconName;

    const html =
      `<strong>${label}</strong>` +
      desc.map(d => `<div>• ${d}</div>`).join("");

    showTooltip(html, e.pageX, e.pageY);
  });

  img.addEventListener("mouseleave", hideTooltip);

  target.appendChild(img);
}

/**
 * Render Screen 5: Company logo sized by number of uncategorized benefits
 */
function renderLogo() {
  // const companyData = benefitData[currentCompany];
  // if (!companyData) return;

  // const extra = companyData.uncategorized || [];
  // const extraCount = extra.length;

  // const container = document.querySelector(".screen-5 .screen-icons");
  // if (!container) return;

  // container.innerHTML = "";

  // const img = document.createElement("img");
  // img.src = `../dataset/logos/images/${currentCompany}.png`;
  // img.alt = `${currentCompany} logo`;
  // img.className = "benefitIcon logoIcon";

  // const baseWidth = 15; // 30% width
  // const scale = 1 + 0.15 * extraCount; // +5% per uncategorized benefit
  // const widthPercent = Math.min(baseWidth * scale, 80); // cap at 80%

  // img.style.position = "absolute";
  // img.style.left = "50%";
  // img.style.top = "50%";
  // img.style.transform = "translate(-50%, -50%)";
  // img.style.width = widthPercent + "%";

  // img.addEventListener("mousemove", (e) => {
  //   let html = `<strong>${currentCompany} — Additional Benefits</strong>`;
  //   if (extraCount === 0) {
  //     html += `<div>• All benefits are represented in the scenes.</div>`;
  //   } else {
  //     html += extra.map(d => `<div>• ${d}</div>`).join("");
  //   }
  //   showTooltip(html, e.pageX, e.pageY);
  // });

  // img.addEventListener("mouseleave", hideTooltip);

  // container.appendChild(img);
}


/* ============================================================
   TOOLTIP
   ============================================================ */

const tooltip = document.getElementById("iconTooltip");

function showTooltip(html, x, y) {
  tooltip.innerHTML = html;
  tooltip.classList.remove("hidden");
  tooltip.classList.add("visible");
  tooltip.style.left = x + 12 + "px";
  tooltip.style.top = y + 12 + "px";
}

function hideTooltip() {
  tooltip.classList.add("hidden");
  tooltip.classList.remove("visible");
}



/* ============================================================
   BEESWARM HELPERS
   ============================================================ */

function extraTooltipHtml(d) {
  const title = d.name || d.ticker;
  let html = `<strong>${title} — Additional Benefits</strong>`;

  if (!d.desc || d.desc.length === 0) {
    html += `<div>• All benefits are represented in Screens 1–4.</div>`;
  } else {
    html += d.desc.map(b => `<div>• ${b}</div>`).join("");
  }
  return html;
}

// Position tooltip LEFT of the icon, vertically centered
function positionTooltipLeftOfIcon(domNode, d) {
  const rect = domNode.getBoundingClientRect();
  const iconX = rect.left + rect.width / 2 + window.scrollX;
  const iconY = rect.top + rect.height / 2 + window.scrollY;

  tooltip.innerHTML = extraTooltipHtml(d);
  tooltip.classList.remove("hidden");
  tooltip.classList.add("visible");

  const tRect = tooltip.getBoundingClientRect();
  const offset = 40; // extra space to the left

  const left = iconX - tRect.width - offset;
  const top = iconY - tRect.height / 2;

  tooltip.style.left = `${Math.max(left, 10)}px`;
  tooltip.style.top = `${Math.max(top, 10)}px`;
}

function pinTooltipForTicker(ticker) {
  if (!beeswarmNodes) return;
  const nodeSel = beeswarmNodes.filter(d => d.ticker === ticker);
  if (nodeSel.empty()) { hideTooltip(); return; }
  const dom = nodeSel.node();
  const d = nodeSel.datum();
  positionTooltipLeftOfIcon(dom, d);
}

// Update visuals when highlight changes
// Behavior:
//  - Unlocked (highlightedTicker == null):
//      * All icons: scale(1), opacity 1, no glow/square
//  - Locked:
//      * Selected icon: scale(2), opacity 1, glow+square visible
//      * Others: scale(1), opacity 0.4, no glow/square
function updateHighlighting() {
  if (!beeswarmNodes) return;

  beeswarmNodes.each(function(d) {
    const g = d3.select(this);
    const glow = g.select(".beeGlow");
    const box  = g.select(".beeBox");

    if (!highlightedTicker) {
      // Unlocked mode
      glow.style("opacity", 0);
      box.style("opacity", 0);
      g.style("opacity", 1)
       .attr("transform", `translate(${d.x}, ${d.y}) scale(1)`);
    } else {
      const isSelected = (d.ticker === highlightedTicker);

      if (isSelected) {
        glow.style("opacity", 1);
        box.style("opacity", 1);
        g.style("opacity", 1)
         .attr("transform", `translate(${d.x}, ${d.y}) scale(${BEE_ENLARGE})`);
        g.moveToFront();
      } else {
        glow.style("opacity", 0);
        box.style("opacity", 0);
        g.style("opacity", 0.4)
         .attr("transform", `translate(${d.x}, ${d.y}) scale(1)`);
      }
    }
  });
}

function updateResetButtonVisibility() {
  const btn = document.getElementById("resetToSelected");
  if (!btn) return;

  if (!dropdownSelected) {
    btn.style.display = "none";
    return;
  }

  // Show when:
  // - no highlight
  // - OR highlight ≠ dropdownSelected
  if (!highlightedTicker || highlightedTicker !== dropdownSelected) {
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
}

// Click behavior:
//  - If clicking the selected (highlighted) icon → unlock
//  - Otherwise → lock to that ticker (selected)
function handleLogoClick(ticker) {
  if (highlightedTicker === ticker) {
    // unlock
    highlightedTicker = null;
    hoverEnabled = true;
    hideTooltip();
  } else {
    // lock to this ticker
    highlightedTicker = ticker;
    hoverEnabled = true; // still allow hover in locked mode
    pinTooltipForTicker(ticker);
  }

  updateHighlighting();
  updateResetButtonVisibility();
}




/* ============================================================
   RENDER BEESWARM (SCREEN 5)
   ============================================================ */

function renderBeeswarm(data) {
  beeswarmDataGlobal = data;

  const svg = d3.select("#beeswarmPlot");
  svg.selectAll("*").remove();

  const width = svg.node().clientWidth || 600;
  const height = svg.node().clientHeight || 400;

  const margin = { top: 40, right: 40, bottom: 70, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const maxExtra = d3.max(data, d => d.extra) || 0;

  // fixed-x axis: 0 → max+0.5
  beeswarmXScale = d3.scaleLinear()
    .domain([0, maxExtra + 0.5])
    .range([margin.left, width - margin.right])
    .nice();

  const xAxis = d3.axisBottom(beeswarmXScale)
    .ticks(Math.min(maxExtra + 1, 8))
    .tickFormat(d3.format("d"));

  svg.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 30)
    .attr("text-anchor", "middle")
    .attr("fill", "#e6eefc")
    .text("Number of Additional Benefits");

  // Reset button roughly above right end of axis (CSS mainly controls this)
  const logoSize = 34;

  // Initialize each node at its fixed x position
  data.forEach(d => {
    d.x = beeswarmXScale(d.extra);
    d.y = height / 2;
  });

  // Build nodes
  beeswarmNodes = svg.append("g")
    .attr("class", "bee-nodes")
    .selectAll("g.company-node")
    .data(data, d => d.ticker)
    .join("g")
    .attr("class", "company-node")
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .each(function(d) {
      const g = d3.select(this);

      // Ambient glow circle (hidden initially)
      g.append("circle")
        .attr("class", "beeGlow")
        .attr("r", logoSize * 0.9)
        .attr("cx", 0)
        .attr("cy", 0)
        .style("fill", "rgba(94, 168, 255, 0.28)")
        .style("filter", "blur(18px)")
        .style("opacity", 0);

      // Tight blue square box (hidden initially)
      g.append("rect")
        .attr("class", "beeBox")
        .attr("x", -logoSize / 2)
        .attr("y", -logoSize / 2)
        .attr("width", logoSize)
        .attr("height", logoSize)
        .style("fill", "none")
        .style("stroke", "#5ea8ff")
        .style("stroke-width", 2)
        .style("opacity", 0);

      // Logo image
      g.append("image")
        .attr("href", d.logo)
        .attr("x", -logoSize / 2)
        .attr("y", -logoSize / 2)
        .attr("width", logoSize)
        .attr("height", logoSize)
        .style("opacity", 0)
        .transition()
        .duration(550)
        .delay((_, i) => i * 18)
        .style("opacity", 1);
    });
  
    

  // Hover behavior (applies in both locked & unlocked modes)
  beeswarmNodes
    .on("mouseenter", function(event, d) {
      const g = d3.select(this);
      const glow = g.select(".beeGlow");
      const box  = g.select(".beeBox");
      const isSelected = (highlightedTicker && d.ticker === highlightedTicker);

      g.moveToFront();

      if (!highlightedTicker) {
        // UNLOCKED MODE: hover gives enlarge + glow + tooltip
        glow.style("opacity", 1);
        box.style("opacity", 1);
        g.transition().duration(120)
          .attr("transform", `translate(${d.x}, ${d.y}) scale(${BEE_ENLARGE})`);

        positionTooltipLeftOfIcon(this, d);
      } else {
        // LOCKED MODE:
        if (isSelected) {
          // Selected stays enlarged
          g.transition().duration(120)
            .attr("transform", `translate(${d.x}, ${d.y}) scale(${BEE_ENLARGE})`);
          
          // Tooltip stays on selected (do NOT change tooltip)
          pinTooltipForTicker(highlightedTicker);
        } else {
          // Hovering other icons in locked mode:
          // enlarge ONLY, NO tooltip, NO glow
          glow.style("opacity", 0);
          box.style("opacity", 0);

          g.transition().duration(120)
            .attr("transform", `translate(${d.x}, ${d.y}) scale(${BEE_ENLARGE})`);

          // no tooltip change
          pinTooltipForTicker(highlightedTicker);
        }
      }
    })



    .on("mousemove", function(event, d) {
      if (!highlightedTicker) {
        positionTooltipLeftOfIcon(this, d);
      } else {
        // LOCKED MODE — tooltip stays on selected only
        pinTooltipForTicker(highlightedTicker);
      }
    })

    .on("mouseleave", function(event, d) {
      const g = d3.select(this);
      const glow = g.select(".beeGlow");
      const box  = g.select(".beeBox");
      const isSelected = (highlightedTicker && d.ticker === highlightedTicker);

      if (!highlightedTicker) {
        // UNLOCKED — normal revert
        glow.style("opacity", 0);
        box.style("opacity", 0);
        g.transition().duration(120)
          .attr("transform", `translate(${d.x}, ${d.y}) scale(1)`);
        hideTooltip();
      } else {
        // LOCKED MODE — tooltip MUST remain visible on selected icon
        if (!isSelected) {
          // returning from other icons
          g.transition().duration(120)
            .attr("transform", `translate(${d.x}, ${d.y}) scale(1)`);
        }

        // Do NOT hide tooltip, EVER, in locked mode
        updateHighlighting();
        pinTooltipForTicker(highlightedTicker);
      }
    })



    .on("click", function(event, d) {
      handleLogoClick(d.ticker);
      event.stopPropagation(); // ⭐ IMPORTANT
    });


  // Vertical-only beeswarm simulation with slightly tighter spacing
  const simulation = d3.forceSimulation(data)
    .force("y", d3.forceY(height / 2).strength(0.4))
    .force("collide", d3.forceCollide(logoSize * 0.65))  // slightly less spacing
    .alpha(1)
    .alphaDecay(0.03)
    .on("tick", () => {
      // lock x back to the scale every tick
      data.forEach(d => {
        d.x = beeswarmXScale(d.extra);
      });

      beeswarmNodes
        .attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

  simulation.on("end", () => {
    updateHighlighting();
    if (highlightedTicker) {
      pinTooltipForTicker(highlightedTicker);
    }
  });

  // Clicking background unlocks the view
  svg.on("click", function(event) {
    // If the click hit the background (not an icon group)
    if (event.target.tagName === "svg") {
      highlightedTicker = null;
      updateHighlighting();
      hideTooltip();
      updateResetButtonVisibility();
    }
  });

  
}



/* ============================================================
   LOAD & CLASSIFY EACH COMPANY (with beeswarm)
   ============================================================ */

Promise.all([
  d3.csv("../dataset/cleaned/Company-benefits.csv"),
  d3.csv("../dataset/cleaned/Company-info.csv")
]).then(([benefitCSV, infoCSV]) => {
  const dropdown = document.getElementById("companySelect");
  const statusSpan = document.getElementById("companyStatus");

  // Build ticker -> full name lookup
  const tickerToName = {};
  infoCSV.forEach(row => {
    tickerToName[row.Ticker] = row.Name;
  });

  // Unique tickers present in the benefits file
  const tickers = [...new Set(benefitCSV.map(d => d.Ticker))];

  // Populate dropdown with full names (fallback to ticker)
  tickers.forEach(ticker => {
    const op = document.createElement("option");
    op.value = ticker;
    op.textContent = tickerToName[ticker] || ticker;
    dropdown.appendChild(op);
  });

  // Classify each company and build benefitData as before
  tickers.forEach(ticker => {
    const rows = benefitCSV.filter(r => r.Ticker === ticker);
    benefitData[ticker] = classifyCompany(rows);
  });

  // Build beeswarm data: one point per company
  const beeswarmData = tickers.map(ticker => {
    const companyData = benefitData[ticker];
    const extra = companyData.uncategorized || [];
    return {
      ticker,
      name: tickerToName[ticker] || ticker,
      logo: `../dataset/logos/images/${ticker}.png`,
      extra: extra.length,
      desc: extra
    };
  });

  // Render beeswarm once
  renderBeeswarm(beeswarmData);

  // Default selection: first ticker
  currentCompany = tickers[0];
  dropdownSelected = tickers[0];
  dropdown.value = tickers[0];

  statusSpan.textContent = "";
  renderIcons();

  // Start in "highlight selected" mode
  highlightedTicker = dropdownSelected;
  hoverEnabled = false;
  // wait until SVG nodes actually exist (in next event loop turn)
  // behave exactly like the user clicked the first company
  setTimeout(() => {
    highlightedTicker = null;  // ensure fresh lock
    handleLogoClick(dropdownSelected);
  }, 80);


  // Dropdown change -> change company AND highlight in beeswarm
  dropdown.addEventListener("change", () => {
    currentCompany = dropdown.value;
    dropdownSelected = dropdown.value;

    renderIcons();

    highlightedTicker = dropdownSelected;
    hoverEnabled = false;
    updateHighlighting();
    pinTooltipForTicker(dropdownSelected);
    updateResetButtonVisibility();
  });

  // "Show Selected Company" button behavior
  const resetBtn = document.getElementById("resetToSelected");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!dropdownSelected) return;
      highlightedTicker = dropdownSelected;
      hoverEnabled = false;
      updateHighlighting();
      pinTooltipForTicker(dropdownSelected);
      updateResetButtonVisibility();
    });
  }
}).catch(err => {
  console.error("Error loading CSVs:", err);
  const statusSpan = document.getElementById("companyStatus");
  if (statusSpan) {
    statusSpan.textContent = "⚠️ Could not load data";
  }
});

