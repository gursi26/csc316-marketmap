d3.csv("dataset/cleaned/Company-salary.csv").then(data => {
    const viz = new SlopeChart("#canvas", data);
    viz.wrangleData();
});
