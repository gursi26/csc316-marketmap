let currentScreen = 0;
const totalScreens = 4;

const track = document.querySelector(".track");

// Touch/swipe variables
let touchStartX = 0;
let touchEndX = 0;
let isDragging = false;

const benefitDescriptions = {};

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
  
    // PHONE
    "phone1": "Phone Boost — Level 1",
    "phone2": "Phone Boost — Level 2",
  
    // OFFICE
    "clinic": "On-Site Clinic",
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
    "shuttle": "Shuttle Service",
  };
  

function goToScreen(index) {
  if (index < 0) index = 0;
  if (index >= totalScreens) index = totalScreens - 1;
  
  currentScreen = index;
  track.style.transform = `translateX(-${currentScreen * 100}vw)`;
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

  // screen swiping
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
let mouseStartX = 0;
let mouseEndX = 0;
let isMouseDragging = false;

track.addEventListener("mousedown", (e) => {
  mouseStartX = e.clientX;
  isMouseDragging = true;
  track.style.cursor = "grabbing";
});

track.addEventListener("mousemove", (e) => {
  if (!isMouseDragging) return;
  mouseEndX = e.clientX;
});

track.addEventListener("mouseup", () => {
  if (!isMouseDragging) return;
  isMouseDragging = false;
  track.style.cursor = "grab";
  
  const swipeThreshold = 50;
  const diff = mouseStartX - mouseEndX;

  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      goToScreen(currentScreen + 1);
    } else {
      goToScreen(currentScreen - 1);
    }
  }

  mouseStartX = 0;
  mouseEndX = 0;
});

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

// populate dropdown
d3.csv(("../dataset/cleaned/Company-benefits.csv")).then(data => {
  const dropdown = document.getElementById("companySelect");

  const uniqueTickers = [...new Set(data.map(d => d.Ticker))];

  uniqueTickers.forEach(ticker => {
    const opt = document.createElement("option");
    opt.value = ticker;
    opt.textContent = ticker;
    dropdown.appendChild(opt);
  });
}).catch(err => {
  console.error("Error loading CSV:", err);
  document.getElementById("companyStatus").textContent = "⚠️ Could not load data";
});

// CLASSIFY BENEFITS DATA

let benefitData = {};
let currentCompany = null;

const officeKeywords = {
  gym: ["gym", "fitness"],
  child: ["maternity", "fertility", "paternity", "mother", "adoption"],
  roth: ["401", "roth", "espp", "fsa"],
  phone: ["phone"],
  tuition: ["tuition", "learning"],
  clinic: ["clinic"],
  petwork: ["pet friendly workplace"] 
};

const foodKeywords = {
  breakfast: ["breakfast"],
  lunch: ["lunch"],
  dinner: ["dinner"],
  snack: ["snack"],
  drink: ["drink"]
};

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

const transportKeywords = {
  transit: ["transit"],
  transport: ["transport"],
  bike: ["bike"],
  shuttle: ["shuttle"]
};


// COUNT-BASED ICON RESOLUTION, (gym1,2, 3 etc)

function resolveCountedIcon(count, base) {
  if (count >= 3) return `${base}3`;
  if (count === 2) return `${base}2`;
  if (count === 1) return `${base}1`;
  return null;
}

// CLASSIFY COMPANY INTO ICONS

function classifyCompany(rows) {

    let descStore = {
      gym: [],
      child: [],
      roth: [],
      phone: [],
      tuition: [],
      clinic: [],
      petwork: [],
  
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
      phone: 0
    };
  
    let icons = {
      gym: null,
      child: null,
      roth: null,
      phone: null,
  
      tuition: false,
      clinic: false,
      petwork: false,
  
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
  
    rows.forEach(r => {
      const desc = r["Benefit Description"].toLowerCase().trim();
  
      // COUNTED
      for (let base in counts) {
        if (officeKeywords[base].some(key => desc.includes(key))) {
          counts[base]++;
          descStore[base].push(r["Benefit Description"]);
        }
      }
  
      // OFFICE BOOL
      if (officeKeywords.tuition.some(k => desc.includes(k))) {
        icons.tuition = true;
        descStore.tuition.push(r["Benefit Description"]);
      }
  
      if (officeKeywords.clinic.some(k => desc.includes(k))) {
        icons.clinic = true;
        descStore.clinic.push(r["Benefit Description"]);
      }
  
      if (officeKeywords.petwork.some(k => desc.includes(k))) {
        icons.petwork = true;
        descStore.petwork.push(r["Benefit Description"]);
      }
  
      // FOOD
      for (let f in foodKeywords) {
        if (foodKeywords[f].some(k => desc.includes(k))) {
          icons[f] = true;
          descStore[f].push(r["Benefit Description"]);
        }
      }
  
      // INSURANCE
      for (let iname in insuranceKeywords) {
        if (insuranceKeywords[iname].some(k => desc.includes(k))) {
          icons[iname] = true;
          descStore[iname].push(r["Benefit Description"]);
        }
      }
  
      // TRANSPORT
      for (let tname in transportKeywords) {
        if (transportKeywords[tname].some(k => desc.includes(k))) {
          icons[tname] = true;
          descStore[tname].push(r["Benefit Description"]);
        }
      }
    });
  
    // Resolve counted icons
    icons.gym = resolveCountedIcon(counts.gym, "gym");
    icons.child = resolveCountedIcon(counts.child, "child");
    icons.roth = resolveCountedIcon(counts.roth, "roth");
  
    if (counts.phone >= 2) icons.phone = "phone2";
    else if (counts.phone === 1) icons.phone = "phone1";
  
    // MAP FINAL ICON FILENAMES → tooltip store
    for (let key in icons) {
      const iconVal = icons[key];
  
      if (!iconVal) continue;
  
      // counted icons
      if (typeof iconVal === "string" && ICON_FILES[iconVal]) {
        benefitDescriptions[ICON_FILES[iconVal]] = descStore[key];
      }
  
      // boolean icons
      if (iconVal === true) {
        benefitDescriptions[ICON_FILES[key]] = descStore[key];
      }
    }
  
    return icons;
  }
  

// LOAD & CLASSIFY EACH COMPANY
d3.csv("../dataset/cleaned/Company-benefits.csv").then(data => {
  const dropdown = document.getElementById("companySelect");

  const tickers = [...new Set(data.map(d => d.Ticker))];

  tickers.forEach(t => {
    const op = document.createElement("option");
    op.value = t;
    op.textContent = t;
    dropdown.appendChild(op);
  });

  // group rows per company
  tickers.forEach(t => {
    const rows = data.filter(r => r.Ticker === t);
    benefitData[t] = classifyCompany(rows);
  });

  dropdown.addEventListener("change", () => {
    currentCompany = dropdown.value;
    renderIcons();
  });

  // set default
  currentCompany = tickers[0];
  renderIcons();
});


// RENDER ICONS INTO SCREENS

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
  
    // Office
    "clinic": "clinic.png",
    "tuition": "tuition.png",
    "pet friendly WORKPLACE": "pet friendly workplace.png",
    //"unique": "insurance.png", // TEMPORARY 
  
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
   Each key corresponds to an iconName or counted icon (gym1/gym2/…)
   Coordinates are relative to the screen (0–100).
   ============================================================ */

const POSITION_MAP = {
  // ---------- SCREEN 1: OFFICE ----------
  "gym1":  { screen: 1, x: 40,  y: 82 },
  "gym2":  { screen: 1, x: 40,  y: 82, rotate: 45, scale: 1 },
  "gym3":  { screen: 1, x: 41,  y: 83, rotate: -45, scale: 1.4 },

  "child1": { screen: 1, x: 8.2, y: 58, rotate: -45 },
  "child2": { screen: 1, x: 8.5, y: 56, scale: 0.9 },
  "child3": { screen: 1, x: 8.5, y: 55.5 },

  "roth1": { screen: 1, x: 50, y: 60 },
  "roth2": { screen: 1, x: 40, y: 42, scale: 0.7},
  "roth3": { screen: 1, x: 40, y: 41.5, scale: 0.8},

  "phone1": { screen: 1, x: 60, y: 40, scale: 1.2 },
  "phone2": { screen: 1, x: 60, y: 47, scale: 1.2 },

  "tuition": { screen: 1, x: 12, y: 22 },
  "clinic":  { screen: 1, x: 27, y: 18 },
  "pet friendly WORKPLACE": { screen: 1, x: 25, y: 90, scale: 1.5 },


  // ---------- SCREEN 2: TRANSPORT ----------
  "transit":   { screen: 2, x: 25, y: 80, scale: 2 },
  "transport": { screen: 2, x: 45, y: 65, scale: 2 },
  "bike":      { screen: 2, x: 60, y: 55, scale: 1.2 },
  "shuttle":   { screen: 2, x: 75, y: 80, scale: 2 },


  // ---------- SCREEN 3: FOOD / VENDING ----------
  "breakfast": { screen: 3, x: 25, y: 31, scale: 2 },
  "lunch":     { screen: 3, x: 25, y: 50, scale: 2 },
  "dinner":    { screen: 3, x: 25, y: 65, scale: 1.9 },
  "snack":     { screen: 3, x: 50, y: 32, scale: 2 },
  "drink":     { screen: 3, x: 50, y: 49, scale: 2 },


  // ---------- SCREEN 4: INSURANCE ----------

  "life":           { screen: 4, x: 15.7, y: 32 },  // upper-left, closer to blue edge
  "vision":         { screen: 4, x: 71, y: 15 },  // top-center
  "dental":         { screen: 4, x: 84, y: 32 },  // upper-right
  "health":         { screen: 4, x: 28, y: 15 },  // right shoulder

  "disability":     { screen: 4, x: 18, y: 60 },  // mid-left band
  "AD&D":           { screen: 4, x: 82, y: 60 },  // mid-right band

  "pet insurance":  { screen: 4, x: 33, y: 84 },  // lower-left curve
  "business travel":{ screen: 4, x: 67, y: 84 }   // lower-right curve


};

  

function renderIcons() {
  const ico = benefitData[currentCompany];

  // Clear all screens
  document.querySelectorAll(".screen-icons").forEach(el => el.innerHTML = "");

  // SCREEN 1 — OFFICE
  place(1, ico.gym);
  place(1, ico.child);
  place(1, ico.roth);
  place(1, ico.phone);
  if (ico.tuition) place(1, "tuition");
  if (ico.clinic) place(1, "clinic");
  if (ico.petwork) place(1, "pet friendly WORKPLACE");
  //if (ico.unique) place(1, "unique");

  // SCREEN 2 — TRANSPORT
  if (ico.transit) place(2, "transit");
  if (ico.transport) place(2, "transport");
  if (ico.bike) place(2, "bike");
  if (ico.shuttle) place(2, "shuttle");

  // SCREEN 3 — VENDING MACHINE/FOOD
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

  // Create the icon element
  const img = document.createElement("img");
  img.src = `../dataset/Icons/${file}`;
  img.className = "benefitIcon";

  // --- NEW: positioning support ---
  const pos = POSITION_MAP[iconName];
  if (pos && pos.screen === screenIndex) {
    img.style.position = "absolute";
    img.style.left = pos.x + "%";
    img.style.top = pos.y + "%";

    const angle = pos.rotate ?? 0;   // degrees
    const scale = pos.scale ?? 1;    // 1 = normal size

    img.style.transform =
      `translate(-50%, -50%) rotate(${angle}deg) scale(${scale})`;
  }

  // Hover tooltip events
  img.addEventListener("mousemove", (e) => {
    const desc = benefitDescriptions[file] || ["No further details available"];

    const label = FRIENDLY_LABELS[iconName] || iconName;

    const html =
      `<strong>${label}</strong>` +
      desc.map(d => `<div>• ${d}</div>`).join("");

    showTooltip(html, e.pageX, e.pageY);
  });

  img.addEventListener("mouseleave", hideTooltip);

  target.appendChild(img);
}

  

// tooltip
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
  