d3.csv("dataset/cleaned/Company-salary.csv").then(data => {
    const viz = new CompensationBubbles("#canvas", data);
    viz.wrangleData();
});
