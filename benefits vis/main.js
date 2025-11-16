let currentScreen = 0;
const totalScreens = 4;

const track = document.querySelector(".track"); // Fixed: was looking for #carouselWrapper

// Touch/swipe variables
let touchStartX = 0;
let touchEndX = 0;
let isDragging = false;

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

  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // Swiped left -> next screen
      goToScreen(currentScreen + 1);
    } else {
      // Swiped right -> previous screen
      goToScreen(currentScreen - 1);
    }
  }

  touchStartX = 0;
  touchEndX = 0;
});

// Mouse drag support (for desktop testing)
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

// Load CSV + populate dropdown
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

// -----------------------------------------
// LOAD AND CLASSIFY BENEFITS DATA
// -----------------------------------------

let benefitData = {};
let currentCompany = null;

const officeKeywords = {
  gym: ["gym", "fitness"],
  child: ["maternity", "fertility", "paternity", "mother", "adoption"],
  roth: ["401", "roth", "espp", "fsa"],
  phone: ["phone"],
  tuition: ["tuition", "learning"],
  clinic: ["clinic"],
  petwork: ["pet friendly workplace"] // EXACT phrase
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

// --------------------------------
// COUNT-BASED ICON RESOLUTION
// --------------------------------
function resolveCountedIcon(count, base) {
  if (count >= 3) return `${base}3`;
  if (count === 2) return `${base}2`;
  if (count === 1) return `${base}1`;
  return null;
}

// --------------------------------
// CLASSIFY COMPANY INTO ICONS
// --------------------------------
function classifyCompany(rows) {
  const counts = {
    gym: 0,
    child: 0,
    roth: 0,
    phone: 0
  };

  let icons = {
    // Office icons (counted)
    gym: null,
    child: null,
    roth: null,
    phone: null,

    // Office additional
    tuition: false,
    clinic: false,
    petwork: false,
    //unique: false,

    // Food
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
    drink: false,

    // Insurance
    life: false,
    vision: false,
    dental: false,
    health: false,
    disability: false,
    ADnD: false,
    petins: false,
    bustravel: false,

    // Transport
    transit: false,
    transport: false,
    bike: false,
    shuttle: false
  };

  rows.forEach(r => {
    const desc = r["Benefit Description"].toLowerCase().trim();
    const category = r["Benefit Category"].toLowerCase();

    // // UNIQUE CATEGORY
    // if (category.startsWith("unique to")) {
    //   icons.unique = true;
    //   return;
    // }

    // OFFICE — count based
    for (let base in counts) {
      if (officeKeywords[base].some(key => desc.includes(key))) {
        counts[base]++;
      }
    }

    // OFFICE — simple booleans
    if (officeKeywords.tuition.some(k => desc.includes(k))) icons.tuition = true;
    if (officeKeywords.clinic.some(k => desc.includes(k))) icons.clinic = true;
    if (officeKeywords.petwork.some(k => desc.includes(k))) icons.petwork = true;

    // FOOD
    for (let f in foodKeywords) {
      if (foodKeywords[f].some(k => desc.includes(k))) icons[f] = true;
    }

    // INSURANCE
    for (let iname in insuranceKeywords) {
      if (insuranceKeywords[iname].some(k => desc.includes(k))) icons[iname] = true;
    }

    // TRANSPORT
    for (let tname in transportKeywords) {
      if (transportKeywords[tname].some(k => desc.includes(k))) icons[tname] = true;
    }
  });

  // RESOLVE counted icons
  icons.gym = resolveCountedIcon(counts.gym, "gym");
  icons.child = resolveCountedIcon(counts.child, "child");
  icons.roth = resolveCountedIcon(counts.roth, "roth");

  // Phone is special: 1 or 2+ only
  if (counts.phone >= 2) icons.phone = "phone2";
  else if (counts.phone === 1) icons.phone = "phone1";

  return icons;
}

// -------------------------------------------
// LOAD CSV & CLASSIFY EACH COMPANY
// -------------------------------------------
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
// ------------------------------------------------
// RENDER ICONS INTO THE FOUR SCREENS (1–4)
// ------------------------------------------------
// Correct icon filenames based on your actual folder
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
}


// Place icon into screen-1 ... screen-4
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
    img.className = "icon-small";
    img.title = iconName;
    target.appendChild(img);
  }
  
