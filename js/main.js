let viz, mapViz, sections, currentSectionIndex, popupCompany, closeCompany, popupGuide, closeGuide;

Promise.all([
    d3.csv("../dataset/cleaned/Company-salary.csv"),
    d3.csv("../dataset/cleaned/Company-info.csv")
]).then(([salaryData, companyInfo]) => {
    viz = new SlopeChart("#canvas", salaryData, companyInfo);
    // expose for parent to control via postMessage
    window.SLOPE_VIZ = viz;
    // If opened with a ticker query param, focus that company
    const params = new URLSearchParams(window.location.search);
    const qTicker = params.get('ticker');
    if (qTicker) {
        viz.viewMode = 'company';
        viz.selectedCompany = decodeURIComponent(qTicker);
    }
    viz.wrangleData();

    // allow parent frame to focus a company via postMessage
    window.addEventListener('message', (ev) => {
        const msg = ev && ev.data;
        if (!msg || !msg.type) return;
        if (msg.type === 'focusCompany' && msg.ticker) {
            try {
                viz.viewMode = 'company';
                viz.selectedCompany = msg.ticker;
                viz.wrangleData();
            } catch (e) { console.error(e); }
        }
    }, false);

    mapViz = new MapVis();

}).catch(error => {
    console.error("Error loading data:", error);
});

// Combined view now only hosts the map iframe full-bleed. The map itself
// shows a small popup for details/roles and handles navigation. No right
// panel is used here to avoid the white area on the right.
document.addEventListener('DOMContentLoaded', () => {
    // Get all the sections that can be navigated
    sections = document.querySelectorAll('.section');
    currentSectionIndex = 0;
    
    popupGuide = document.getElementById('guide-popup');
    closeGuide = document.getElementById('close-guide-popup');
    popupCompany = document.getElementById('company-detail-popup');
    closeCompany = document.getElementById('close-company-detail-popup');

    // Add keyboard event listener to the whole document
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault(); // Prevent default browser scrolling
            scrollToSection(currentSectionIndex + 1);
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault(); // Prevent default browser scrolling
            scrollToSection(currentSectionIndex - 1);
        }
    });

    document.getElementById('scrollDownButton').addEventListener('click', function() {
        scrollToSection(1);
    });

    document.getElementById('guideButton').addEventListener('click', function() {
        popupGuide.showModal();
    });

    closeGuide.addEventListener('click', () => {
        popupGuide.close();
    });

    popupGuide.addEventListener('click', (event) => {
        // Check if the click target is the dialog element itself, not a child
        if (event.target === popupGuide) {
            popupGuide.close();
        }
    });

    closeCompany.addEventListener('click', () => {
        popupCompany.close();
    });

    popupCompany.addEventListener('click', (event) => {
        // Check if the click target is the dialog element itself, not a child
        if (event.target === popupCompany) {
            popupCompany.close();
        }
    });
});

function navigateToSlopeMap(ticker) {
    try {
        viz.viewMode = 'company';
        viz.selectedCompany = ticker;
        viz.wrangleData();
    } catch (e) { console.error(e); }
    scrollToSection(2);
};

// Function to scroll to a specific section index
const scrollToSection = (index) => {
    // Ensure the index is within the valid range
    if (index >= 0 && index < sections.length) {
        sections[index].scrollIntoView({ 
            behavior: 'smooth' 
        });
        currentSectionIndex = index;
    }
};
