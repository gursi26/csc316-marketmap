d3.csv("dataset/cleaned/Company-salary.csv").then(data => {
    const viz = new CompensationBubbles("#canvas", data);
    
    const tickers = [...new Set(data.map(d => d.Ticker))].sort();
    const dropdown = d3.select("#ticker-dropdown");
    
    dropdown.selectAll("option")
        .data(tickers)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);
    
    dropdown.on("change", function() {
        viz.currentTicker = this.value;
        viz.updateVis();
    });
});
