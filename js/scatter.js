// Set up dimensions and margins
const margin = { top: 120, right: 120, bottom: 120, left: 120 };

// ===== TUNABLE CONSTANT: Circle Size Scaling =====
// Adjust this value to control how large the bubbles appear relative to window size
const CIRCLE_SIZE_SCALE_FACTOR = 0.03;

let width, height;

// dimensions based on container size
function calculateDimensions() {
    const container = document.querySelector('.chart-container-scatter');
    const containerRect = container.getBoundingClientRect();
    width = Math.max(600, containerRect.width - margin.left - margin.right - 40);
    height = Math.max(400, containerRect.height - margin.top - margin.bottom - 40);
    return { width, height };
}

const svg = d3.select("#scatterplot");
let g = svg.append("g");

function updateSVGDimensions() {
    calculateDimensions();
    svg.attr("width", width + margin.left + margin.right)
       .attr("height", height + margin.top + margin.bottom);
    g.attr("transform", `translate(${margin.left},${margin.top})`);
}

const tooltip = d3.select("#tooltip-scatter");

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
            d3.csv("dataset/cleaned/Company-info.csv"),
            d3.csv("dataset/cleaned/Company-financials.csv"),
            d3.csv("dataset/raw-data/nasdaq100_monthly_s2024.csv")
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

    // Make circle size responsive to window dimensions
    const avgDimension = (width + height) / 2;
    const minRadius = avgDimension * CIRCLE_SIZE_SCALE_FACTOR * 0.2;
    const maxRadius = avgDimension * CIRCLE_SIZE_SCALE_FACTOR;
    
    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => d.market_cap))
        .range([minRadius, maxRadius]);

    return { xScale, yScale, sizeScale };
}

// Create axes
function createAxes(xScale, yScale, xAxis, yAxis) {
    // Custom formatters for different axes
    const xFormat = getAxisFormatter(xAxis);
    const yFormat = getAxisFormatter(yAxis);
    
    const xAxisGenerator = d3.axisBottom(xScale)
        .tickFormat(xFormat)
        .tickSize(6)
        .tickPadding(10);

    const yAxisGenerator = d3.axisLeft(yScale)
        .tickFormat(yFormat)
        .tickSize(6)
        .tickPadding(10);

    // Remove existing axes
    g.selectAll(".x-axis").remove();
    g.selectAll(".y-axis").remove();
    g.selectAll(".x-label").remove();
    g.selectAll(".y-label").remove();

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxisGenerator)
        .selectAll("text")
        .style("font-size", "14px");

    g.append("g")
        .attr("class", "y-axis")
        .call(yAxisGenerator)
        .selectAll("text")
        .style("font-size", "14px");

    // Add axis labels
    g.append("text")
        .attr("class", "x-label axis-label")
        .attr("transform", `translate(${width/2}, ${height + 60})`)
        .style("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "600")
        .text(getAxisLabel(xAxis));

    g.append("text")
        .attr("class", "y-label axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 35)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "600")
        .text(getAxisLabel(yAxis));
}
function getAxisFormatter(axis) {
    if (axis === 'revenue' || axis === 'market_cap') {
        // Format large numbers in billions with B suffix
        return d => {
            if (d >= 1e9) return (d / 1e9).toFixed(1) + 'B';
            if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
            return d.toFixed(0);
        };
    }
    return d3.format(".1f");
}

function getAxisLabel(axis) {
    const labels = {
        ceo_approval: "CEO Approval (%)",
        employee_rating: "Employee Rating (out of 5)",
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
        .text(`Colour represents: ${getAxisLabel(colorBy)}`);

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
        // Create gradient legend for continuous scales
        const domain = d3.extent(data, d => d[colorBy]);
        const colorScale = colorScales[colorBy];
        colorScale.domain(domain);
        
        const colorScaleDiv = content.append("div")
            .attr("class", "color-scale");

        // Create SVG for gradient
        const gradientSvg = colorScaleDiv.append("svg")
            .attr("width", 200)
            .attr("height", 40);

        // Define gradient
        const defs = gradientSvg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", `gradient-${colorBy}`)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        // Add color stops based on the actual color scale
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const value = domain[0] + t * (domain[1] - domain[0]);
            gradient.append("stop")
                .attr("offset", `${t * 100}%`)
                .attr("stop-color", colorScale(value));
        }

        // Draw gradient bar
        gradientSvg.append("rect")
            .attr("x", 30)
            .attr("y", 10)
            .attr("width", 140)
            .attr("height", 20)
            .style("fill", `url(#gradient-${colorBy})`)
            .style("stroke", "#999")
            .style("stroke-width", 1);

        // Add labels
        gradientSvg.append("text")
            .attr("x", 25)
            .attr("y", 25)
            .attr("text-anchor", "end")
            .style("font-size", "11px")
            .style("fill", "#666")
            .text(domain[0].toFixed(1));

        gradientSvg.append("text")
            .attr("x", 175)
            .attr("y", 25)
            .attr("text-anchor", "start")
            .style("font-size", "11px")
            .style("fill", "#666")
            .text(domain[1].toFixed(1));
    }
}

// Update visualization
function updateVisualization(data, xAxis, yAxis, colorBy) {
    // Update dimensions first
    updateSVGDimensions();
    
    const { xScale, yScale, sizeScale } = createScales(data, xAxis, yAxis);
    const colorFunction = createColorFunction(data, colorBy);
    
    createAxes(xScale, yScale, xAxis, yAxis);
    createColorLegend(data, colorBy);

    const circles = g.selectAll("circle")
        .data(data, d => d.ticker)
        .join(
            enter => enter.append("circle")
                .attr("opacity", 0.7)
                .attr("stroke", "#fff")
                .attr("stroke-width", 1)
                .style("cursor", "pointer"),
            update => update,
            exit => exit.remove()
        )
        .attr("cx", d => xScale(d[xAxis]))
        .attr("cy", d => yScale(d[yAxis]))
        .attr("r", d => sizeScale(d.market_cap))
        .attr("fill", colorFunction);

    enableMouseover()
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

    // Initialize dimensions
    calculateDimensions();
    
    // Set initial dropdown values
    d3.select("#x-axis").property("value", "ceo_approval");
    d3.select("#y-axis").property("value", "employee_rating");
    d3.select("#color-by").property("value", "sentiment");
    
    setupControls();
    
    // Get current dropdown values and use them for initial visualization
    const xAxis = d3.select("#x-axis").property("value");
    const yAxis = d3.select("#y-axis").property("value");
    const colorBy = d3.select("#color-by").property("value");
    updateVisualization(data, xAxis, yAxis, colorBy);

    // company focus
    const params = new URLSearchParams(window.location.search);
    const qTicker = params.get('ticker');
    if (qTicker) {
        focusTicker(qTicker);
    }
    
    // Add resize listener with debouncing
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            const xAxis = d3.select("#x-axis").property("value");
            const yAxis = d3.select("#y-axis").property("value");
            const colorBy = d3.select("#color-by").property("value");
            updateVisualization(window.currentData, xAxis, yAxis, colorBy);
        }, 250);
    });
}

document.addEventListener('DOMContentLoaded', init);

// allow parent frame to ask the scatter plot to focus/highlight a company
window.addEventListener('message', (ev) => {
    const msg = ev && ev.data;
    if (!msg || msg.type !== 'focusCompany' || !msg.ticker) return;
    const ticker = (msg.ticker || '').toString().toUpperCase();
    // find circle by ticker
    const sel = d3.selectAll('#scatterplot circle').filter(d => ((d.ticker||d.Ticker)||'').toString().toUpperCase() === ticker);
    if (sel.empty()) return;
    const d = sel.datum();
    // visually highlight
    sel.raise().attr('stroke', '#000').attr('stroke-width', 3).attr('opacity', 1);
    // show tooltip similar to mouseover
    tooltip.style('opacity', 1).html(`
        <strong>${d.name || d.ticker}</strong><br/>
        Sector: ${d.sector || ''}<br/>
        CEO Approval: ${d.ceo_approval || 'n/a'}%<br/>
        Employee Rating: ${d.employee_rating || 'n/a'}<br/>
        Market Cap: $${(d.market_cap || 0).toLocaleString()}<br/>
        Sentiment: ${d.sentiment != null ? d.sentiment.toFixed(3) : 'n/a'}
    `);
    // position tooltip near top-right of the scatter area
    const rect = document.getElementById('scatterplot').getBoundingClientRect();
    tooltip.style('left', (rect.left + 20) + 'px').style('top', (rect.top + 20) + 'px');
    // clear highlight after a few seconds
    setTimeout(() => {
        sel.attr('stroke', '#fff').attr('stroke-width', 1).attr('opacity', 0.7);
        tooltip.style('opacity', 0);
    }, 3000);
}, false);

function focusTicker(ticker){
    if (!ticker) return;
    const t = (ticker||'').toString().toUpperCase();
    const sel = d3.selectAll('#scatterplot circle').filter(d => ((d.ticker||d.Ticker)||'').toString().toUpperCase() === t);
    const nonSel = d3.selectAll('#scatterplot circle').filter(d => ((d.ticker||d.Ticker)||'').toString().toUpperCase() !== t);
    if (sel.empty()) return;
    const d = sel.datum();
    sel.raise().transition().delay(250).duration(1000).attr('stroke-width', 3).attr('opacity', 1);
    nonSel.transition().delay(250).duration(1000).attr('opacity', 0.1)
    disableMouseover()
    tooltip.style('opacity', 1).html(`
        <strong>${d.name || d.ticker}</strong><br/>
        Sector: ${d.sector || ''}<br/>
        CEO Approval: ${d.ceo_approval || 'n/a'}%<br/>
        Employee Rating: ${d.employee_rating || 'n/a'}<br/>
        Market Cap: $${(d.market_cap || 0).toLocaleString()}<br/>
        Sentiment: ${d.sentiment != null ? d.sentiment.toFixed(3) : 'n/a'}
    `);
    
    // Position tooltip near the bubble
    // Use a slight delay to ensure the scroll animation has settled
    setTimeout(() => {
        const circleNode = sel.node();
        if (circleNode) {
            const circleBBox = circleNode.getBoundingClientRect();
            
            // Calculate page coordinates (similar to event.pageX/pageY)
            const pageX = circleBBox.left + window.pageXOffset + circleBBox.width / 2;
            const pageY = circleBBox.top + window.pageYOffset + circleBBox.height / 2;
            
            // Use same offsets as mousemove handler
            tooltip.style('left', (pageX - 250) + 'px').style('top', (pageY - 200) + 'px');
        }
    }, 300);
    
    setTimeout(() => {
        enableMouseover()
        sel.transition().duration(1000).attr('stroke-width', 1).attr('opacity', 0.7);
        nonSel.transition().duration(1000).attr('opacity', 0.7);
        tooltip.style('opacity', 0);
    }, 3000);
}


function disableMouseover() {
    d3.selectAll('#scatterplot circle')
        .on("mouseover", null)
        .on("mousemove", null)
        .on("mouseout", null)
}

function enableMouseover() {
    d3.selectAll('#scatterplot circle')
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
            const tooltipWidth = tooltip.node().offsetWidth;
            const tooltipHeight = tooltip.node().offsetHeight;
        
            // Desired position
            let x = event.pageX + 1;
            let y = event.pageY - 230;
        

            tooltip.style("left", x + "px")
                .style("top", y + "px");

        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("opacity", 0.7)
                .attr("stroke-width", 1);

            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            // Navigate to company detail page
            displayCompanyInfo(d)
            popupCompany.showModal();
        });
}


// Company Details

// Display company information
function displayCompanyInfo(d) {
    const company = d;
    
    if (!company) {
        document.getElementById('company-logo').style.display = 'none';
        return;
    }
    
    // Display company logo
    const logoImg = document.getElementById('company-logo');
    logoImg.src = `dataset/logos/images/${company.ticker}.png`;
    logoImg.style.display = 'block';
    logoImg.onerror = function() {
        // Fallback if logo not found
        this.style.display = 'none';
    };
    
    // Display company details with name as first item
    const infoDiv = document.getElementById('company-info');
    infoDiv.innerHTML = `
        <div class="info-item">
            <span class="info-label">Company:</span> ${company.name}
        </div>
        <div class="info-item">
            <span class="info-label">Ticker:</span> ${company.ticker}
        </div>
        <div class="info-item">
            <span class="info-label">Sector:</span> ${company.sector}
        </div>
        <div class="info-item">
            <span class="info-label">Industry:</span> ${company.industry}
        </div>
        <div class="info-item">
            <span class="info-label">CEO Approval:</span> ${company.ceo_approval}%
        </div>
        <div class="info-item">
            <span class="info-label">Employee Rating:</span> ${company.employee_rating}/5
        </div>
        <div class="info-item">
            <span class="info-label">Market Cap:</span> $${(company.market_cap / 1e9).toFixed(1)}B
        </div>
        <div class="info-item">
            <span class="info-label">Revenue:</span> $${(company.revenue / 1e9).toFixed(1)}B
        </div>
        <div class="info-item">
            <span class="info-label">P/E Ratio:</span> ${company.pe_ratio.toFixed(1)}
        </div>
        <div class="info-item">
            <span class="info-label">Sentiment:</span> ${company.sentiment.toFixed(3)}
        </div>
        <div class="info-item">
            <span class="info-label">Employees:</span> ${company.employee_count.toLocaleString()}
        </div>
    `;
    
    // Store company ticker for the Pay Progression button
    window.currentScatterCompany = company.ticker;
}