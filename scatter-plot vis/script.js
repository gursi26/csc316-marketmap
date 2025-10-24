// Set up dimensions and margins
const margin = { top: 40, right: 40, bottom: 80, left: 80 };
const width = 900 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// Create SVG
const svg = d3.select("#scatterplot")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Create tooltip
const tooltip = d3.select("#tooltip");

// Color scales
const colorScales = {
    sentiment: d3.scaleSequential(d3.interpolateRdBu),
    sector: d3.scaleOrdinal(d3.schemeCategory10),
    employee_rating: d3.scaleSequential(d3.interpolateViridis),
    ceo_approval: d3.scaleSequential(d3.interpolateBlues)
};

// Load and process data
async function loadData() {
    try {
        // Load all CSV files
        const [companyInfo, companyFinancials, sentimentData] = await Promise.all([
            d3.csv("../dataset/cleaned/Company-info.csv"),
            d3.csv("../dataset/cleaned/Company-financials.csv"),
            d3.csv("../dataset/raw-data/nasdaq100_monthly_s2024.csv")
        ]);

        // Get latest sentiment for each company
        const latestSentiment = {};
        sentimentData.forEach(d => {
            if (d.sentiment_score_monthly && !latestSentiment[d.ticker]) {
                latestSentiment[d.ticker] = +d.sentiment_score_monthly;
            }
        });

        // Merge data
        const mergedData = companyInfo.map(info => {
            const financials = companyFinancials.find(f => f.Ticker === info.Ticker);
            const sentiment = latestSentiment[info.Ticker] || 0;
            
            return {
                ticker: info.Ticker,
                name: info.Name,
                sector: info.Sector,
                industry: info.Industry,
                ceo_approval: +info['CEO Approval Percentage'] || 0,
                employee_rating: +info['Employee Rating'] || 0,
                market_cap: +financials?.['Market Cap'] || 0,
                revenue: +financials?.['Total Revenue'] || 0,
                pe_ratio: +financials?.['Trailing PE'] || 0,
                sentiment: sentiment,
                employee_count: +info['Employee Count'] || 0
            };
        }).filter(d => d.market_cap > 0); // Filter out companies without market cap

        console.log("Loaded data:", mergedData.length, "companies");
        return mergedData;
    } catch (error) {
        console.error("Error loading data:", error);
        return [];
    }
}

// Create scales
function createScales(data, xAxis, yAxis) {
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d[xAxis]))
        .range([0, width])
        .nice();

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d[yAxis]))
        .range([height, 0])
        .nice();

    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => d.market_cap))
        .range([3, 30]);

    return { xScale, yScale, sizeScale };
}

// Create axes
function createAxes(xScale, yScale, xAxis, yAxis) {
    const xAxisGenerator = d3.axisBottom(xScale)
        .tickFormat(d3.format(".1f"));

    const yAxisGenerator = d3.axisLeft(yScale)
        .tickFormat(d3.format(".1f"));

    // Remove existing axes
    g.selectAll(".x-axis").remove();
    g.selectAll(".y-axis").remove();
    g.selectAll(".x-label").remove();
    g.selectAll(".y-label").remove();

    // Add X axis
    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxisGenerator);

    // Add Y axis
    g.append("g")
        .attr("class", "y-axis")
        .call(yAxisGenerator);

    // Add axis labels
    g.append("text")
        .attr("class", "x-label axis-label")
        .attr("transform", `translate(${width/2}, ${height + 50})`)
        .style("text-anchor", "middle")
        .text(getAxisLabel(xAxis));

    g.append("text")
        .attr("class", "y-label axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text(getAxisLabel(yAxis));
}

function getAxisLabel(axis) {
    const labels = {
        ceo_approval: "CEO Approval (%)",
        employee_rating: "Employee Rating",
        sentiment: "Sentiment Score",
        pe_ratio: "P/E Ratio",
        revenue: "Revenue ($B)",
        market_cap: "Market Cap"
    };
    return labels[axis] || axis;
}

// Create color function
function createColorFunction(data, colorBy) {
    if (colorBy === 'sector') {
        const sectors = [...new Set(data.map(d => d.sector))];
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        return d => colorScale(d.sector);
    } else {
        const colorScale = colorScales[colorBy];
        const domain = d3.extent(data, d => d[colorBy]);
        colorScale.domain(domain);
        return d => colorScale(d[colorBy]);
    }
}

// Create color legend
function createColorLegend(data, colorBy) {
    const legendContainer = d3.select("#color-legend");
    legendContainer.selectAll("*").remove();

    const title = legendContainer.append("div")
        .attr("class", "color-legend-title")
        .text(`Color represents: ${getAxisLabel(colorBy)}`);

    const content = legendContainer.append("div")
        .attr("class", "color-legend-content");

    if (colorBy === 'sector') {
        // Create sector legend
        const sectors = [...new Set(data.map(d => d.sector))].sort();
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        
        const sectorLegend = content.append("div")
            .attr("class", "sector-legend");

        sectors.forEach(sector => {
            sectorLegend.append("div")
                .attr("class", "sector-item")
                .html(`
                    <div class="sector-color" style="background-color: ${colorScale(sector)}"></div>
                    <span>${sector}</span>
                `);
        });
    } else {
        // Create simple manual color scale
        const domain = d3.extent(data, d => d[colorBy]);
        
        const colorScaleDiv = content.append("div")
            .attr("class", "color-scale");

        // Create simple red-to-blue gradient bar with labels
        const scaleBar = colorScaleDiv.append("div")
            .attr("class", "color-scale-bar")
            .style("background", "linear-gradient(to right, #ff9999, #87ceeb)")
            .style("position", "relative");

        // Add Low label on the left
        scaleBar.append("span")
            .style("position", "absolute")
            .style("left", "-30px")
            .style("top", "50%")
            .style("transform", "translateY(-50%)")
            .style("font-size", "12px")
            .style("color", "#666")
            .text("Low");

        // Add High label on the right
        scaleBar.append("span")
            .style("position", "absolute")
            .style("right", "-30px")
            .style("top", "50%")
            .style("transform", "translateY(-50%)")
            .style("font-size", "12px")
            .style("color", "#666")
            .text("High");
    }
}

// Update visualization
function updateVisualization(data, xAxis, yAxis, colorBy) {
    const { xScale, yScale, sizeScale } = createScales(data, xAxis, yAxis);
    const colorFunction = createColorFunction(data, colorBy);
    
    createAxes(xScale, yScale, xAxis, yAxis);
    createColorLegend(data, colorBy);

    // Remove existing circles
    g.selectAll("circle").remove();

    // Add circles
    const circles = g.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d[xAxis]))
        .attr("cy", d => yScale(d[yAxis]))
        .attr("r", d => sizeScale(d.market_cap))
        .attr("fill", colorFunction)
        .attr("opacity", 0.7)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("cursor", "pointer");

    // Add interactions
    circles
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("opacity", 1)
                .attr("stroke-width", 2);

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.name} (${d.ticker})</strong><br/>
                    Sector: ${d.sector}<br/>
                    CEO Approval: ${d.ceo_approval}%<br/>
                    Employee Rating: ${d.employee_rating}/5<br/>
                    Market Cap: $${(d.market_cap / 1e9).toFixed(1)}B<br/>
                    Sentiment: ${d.sentiment.toFixed(3)}<br/>
                    Employees: ${d.employee_count.toLocaleString()}
                `);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("opacity", 0.7)
                .attr("stroke-width", 1);

            tooltip.style("opacity", 0);
        })
                .on("click", function(event, d) {
                    // Navigate to company detail page
                    const companyData = encodeURIComponent(JSON.stringify(d));
                    window.location.href = `company-detail.html?data=${companyData}`;
                });
}

// Event listeners for controls
function setupControls() {
    d3.select("#x-axis").on("change", function() {
        const xAxis = this.value;
        const yAxis = d3.select("#y-axis").property("value");
        const colorBy = d3.select("#color-by").property("value");
        updateVisualization(window.currentData, xAxis, yAxis, colorBy);
    });

    d3.select("#y-axis").on("change", function() {
        const xAxis = d3.select("#x-axis").property("value");
        const yAxis = this.value;
        const colorBy = d3.select("#color-by").property("value");
        updateVisualization(window.currentData, xAxis, yAxis, colorBy);
    });

    d3.select("#color-by").on("change", function() {
        const xAxis = d3.select("#x-axis").property("value");
        const yAxis = d3.select("#y-axis").property("value");
        const colorBy = this.value;
        updateVisualization(window.currentData, xAxis, yAxis, colorBy);
    });
}

// Initialize visualization
async function init() {
    const data = await loadData();
    window.currentData = data;
    
    if (data.length === 0) {
        console.error("No data loaded");
        return;
    }

    setupControls();
    updateVisualization(data, "ceo_approval", "employee_rating", "sentiment");
}

// Start the visualization when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
