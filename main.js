Promise.all([
    d3.csv("dataset/cleaned/Company-salary.csv"),
    d3.csv("dataset/cleaned/Company-info.csv")
]).then(([salaryData, companyInfo]) => {
    const viz = new SlopeChart("#canvas", salaryData, companyInfo);
    viz.wrangleData();
}).catch(error => {
    console.error("Error loading data:", error);
});
