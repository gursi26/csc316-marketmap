let currentScreen = 0;
const totalScreens = 4;

const wrapper = document.getElementById("carouselWrapper");

// Button listeners
document.getElementById("nextBtn").addEventListener("click", () => {
    if (currentScreen < totalScreens - 1) {
        currentScreen++;
        wrapper.style.transform = `translateX(-${currentScreen * 100}vw)`;
    }
});

document.getElementById("prevBtn").addEventListener("click", () => {
    if (currentScreen > 0) {
        currentScreen--;
        wrapper.style.transform = `translateX(-${currentScreen * 100}vw)`;
    }
});

// Load CSV + populate dropdown
d3.csv("dataset/cleaned/Company-benefits.csv").then(data => {
    const dropdown = document.getElementById("companySelect");

    const uniqueTickers = [...new Set(data.map(d => d.Ticker))];

    uniqueTickers.forEach(ticker => {
        const opt = document.createElement("option");
        opt.value = ticker;
        opt.textContent = ticker;
        dropdown.appendChild(opt);
    });
});
