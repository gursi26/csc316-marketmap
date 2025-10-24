Promise.all([
    d3.csv("../dataset/cleaned/Company-salary.csv"),
    d3.csv("../dataset/cleaned/Company-info.csv")
]).then(([salaryData, companyInfo]) => {
    const viz = new SlopeChart("#canvas", salaryData, companyInfo);
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
}).catch(error => {
    console.error("Error loading data:", error);
});
