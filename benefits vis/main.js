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