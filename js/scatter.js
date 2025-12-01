// Set up dimensions and margins (smaller margins to maximize plot area)
const margin = { top: 60, right: 60, bottom: 60, left: 60 };

const CIRCLE_SIZE_SCALE_FACTOR = 0.025;

let width, height;

// dimensions based on container size
function calculateDimensions() {
    const container = document.querySelector('.chart-container-scatter');
    const containerRect = container.getBoundingClientRect();
    const availWidth = Math.max(0, containerRect.width - margin.left - margin.right - 20);
    const availHeight = Math.max(0, containerRect.height - margin.top - margin.bottom - 20);
    // Clamp against viewport to avoid cumulative growth
    width = Math.max(600, Math.min(availWidth, window.innerWidth - 80));
    height = Math.max(400, Math.min(availHeight, window.innerHeight - 120));
    return { width, height };
}


const svg = d3.select("#scatterplot");
let g = svg.append("g");

function updateSVGDimensions() {
    calculateDimensions();
    
    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;

    svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
       .attr("width", svgWidth)
       .attr("height", svgHeight);
    
    g.attr("transform", `translate(${margin.left},${margin.top})`);
}

const tooltip = d3.select("#tooltip-scatter");

// Color scales
const colorScales = {
    sentiment: d3.scaleSequential(d3.interpolateRdYlGn),
    sector: d3.scaleOrdinal(d3.schemeTableau10),
    employee_rating: d3.scaleSequential(d3.interpolateRdYlGn),
    ceo_approval: d3.scaleSequential(d3.interpolateRdYlGn)
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

// scales -- change for custom tick range
function createScales(data, xAxis, yAxis, sizeMetric) {
    function customDomain(axis) {
        if (axis === "employee_rating") return [0, 5];
        if (axis === "ceo_approval") return [0, 100];
        if (axis === "sentiment") {
            const extent = d3.extent(data, d => +d.sentiment);
            return extent;
        }
        const ext = d3.extent(data, d => +d[axis]);
        if (!isFinite(ext[0]) || !isFinite(ext[1])) return [0, 1];
        return ext;
    }

    const xScale = d3.scaleLinear()
        .domain(customDomain(xAxis))
        .range([0, width])
        .nice();

    const yScale = d3.scaleLinear()
        .domain(customDomain(yAxis))
        .range([height, 0])
        .nice();

    // circle scaling stays
    const avgDimension = (width + height) / 2;
    const minRadius = avgDimension * CIRCLE_SIZE_SCALE_FACTOR * 0.2;
    const maxRadius = avgDimension * CIRCLE_SIZE_SCALE_FACTOR;

    const sizeValues = data.map(d => +d[sizeMetric]).filter(v => isFinite(v) && v > 0);
    const sizeDomain = sizeValues.length ? d3.extent(sizeValues) : [1, 1];

    const sizeScale = d3.scaleSqrt()
        .domain(sizeDomain)
        .range([minRadius, maxRadius]);

    return { xScale, yScale, sizeScale, sizeDomain };
}


// axes
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
        .attr("y", 0 - margin.left - 30)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "600")
        .text(getAxisLabel(yAxis));
}
function getAxisFormatter(axis) {
    if (axis === 'revenue' || axis === 'market_cap' || axis === 'employee_count') {
        return d => formatLargeNumber(d, axis !== 'employee_count');
    }
    if (axis === 'ceo_approval') return d => `${d.toFixed(0)}%`;
    if (axis === 'employee_rating') return d => d.toFixed(1);
    if (axis === 'sentiment') return d3.format(".2f");
    return d3.format(".2f");
}

function getAxisLabel(axis) {
    const labels = {
        ceo_approval: "CEO Approval (%)",
        employee_rating: "Employee Rating (0-5)",
        sentiment: "Sentiment Score",
        pe_ratio: "P/E Ratio",
        revenue: "Revenue ($)",
        market_cap: "Market Cap ($)",
        employee_count: "Employee Count"
    };
    return labels[axis] || axis;
}

function formatLargeNumber(value, includeCurrency = false) {
    if (!isFinite(value)) return "N/A";
    const abs = Math.abs(value);
    const fmt = (val, suffix) => `${includeCurrency ? '$' : ''}${Math.round(val)}${suffix}`;
    if (abs >= 1e12) return fmt(value / 1e12, "T");
    if (abs >= 1e9) return fmt(value / 1e9, "B");
    if (abs >= 1e6) return fmt(value / 1e6, "M");
    if (abs >= 1e3) return fmt(value / 1e3, "K");
    return `${includeCurrency ? '$' : ''}${Math.round(value)}`;
}

function formatLegendValue(metric, value) {
    if (!isFinite(value)) return "N/A";
    if (metric === 'sentiment') return value.toFixed(2);
    if (metric === 'employee_rating') return value.toFixed(1);
    if (metric === 'ceo_approval') return value.toFixed(0) + "%";
    if (metric === 'market_cap' || metric === 'revenue') return formatLargeNumber(value, true);
    if (metric === 'employee_count') return formatLargeNumber(value, false);
    if (metric === 'pe_ratio') return value.toFixed(1);
    return value.toFixed(2);
}

// Create color function
function createColorFunction(data, colorBy) {
    if (colorBy === 'sector') {
        const sectors = [...new Set(data.map(d => d.sector))].filter(Boolean).sort();
        const colorScale = colorScales.sector;
        colorScale.domain(sectors);
        return d => colorScale(d.sector);
    } else {
        const colorScale = colorScales[colorBy];
        const domain = getColorDomain(data, colorBy);
        colorScale.domain(domain);
        return d => colorScale(d[colorBy]);
    }
}

function getColorDomain(data, colorBy) {
    if (colorBy === 'sentiment') {
        const ext = d3.extent(data, d => +d.sentiment);
        if (!isFinite(ext[0]) || !isFinite(ext[1])) return [0, 1];
        if (ext[0] === ext[1]) return [ext[0] - 0.1, ext[1] + 0.1];
        return ext;
    }
    return d3.extent(data, d => +d[colorBy]);
}

// Create color legend
function createColorLegend(data, colorBy) {
    const legendContainer = d3.select("#color-legend");
    legendContainer.selectAll("*").remove();

    const title = legendContainer.append("div")
        .attr("class", "color-legend-title")
        .text(`Colour: ${getAxisLabel(colorBy)}`);

    const content = legendContainer.append("div")
        .attr("class", "color-legend-content");

    if (colorBy === 'sector') {
        // Create sector legend
        const sectors = [...new Set(data.map(d => d.sector))].filter(Boolean).sort();
        const colorScale = colorScales.sector;
        colorScale.domain(sectors);
        
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
        const domain = getColorDomain(data, colorBy);
        const colorScale = colorScales[colorBy];
        colorScale.domain(domain);
        const formatLabel = (value) => formatLegendValue(colorBy, value);
        
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
            .text(formatLabel(domain[0]));

        gradientSvg.append("text")
            .attr("x", 175)
            .attr("y", 25)
            .attr("text-anchor", "start")
            .style("font-size", "11px")
            .style("fill", "#666")
            .text(formatLabel(domain[1]));
    }
}

function createSizeLegend(sizeScale, sizeMetric, sizeDomain, data) {
    const legendContainer = d3.select("#size-legend");
    legendContainer.selectAll("*").remove();

    const values = data.map(d => +d[sizeMetric]).filter(v => isFinite(v) && v > 0).sort((a, b) => a - b);
    if (!values.length) return;

    const minVal = values[0];
    const maxVal = values[values.length - 1];
    const midVal = values[Math.floor(values.length * 0.55)];

    legendContainer.append("div")
        .attr("class", "size-legend-title")
        .text(`Bubble size: ${getAxisLabel(sizeMetric)}`);

    const svgWidth = 300;
    const svgHeight = 80;
    const svg = legendContainer.append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight);

    const markers = [
        { label: "Smaller", value: minVal },
        { label: "Typical", value: midVal },
        { label: "Larger", value: maxVal }
    ];

    const positions = [svgWidth * 0.25, svgWidth * 0.5, svgWidth * 0.75];
    const baseline = 42;

    markers.forEach((marker, i) => {
        const radius = sizeScale(marker.value);
        const cx = positions[i];

        svg.append("circle")
            .attr("cx", cx)
            .attr("cy", baseline)
            .attr("r", radius)
            .attr("fill", "rgba(255,255,255,0.08)")
            .attr("stroke", "#9aa4ff")
            .attr("stroke-width", 1.4);

        svg.append("text")
            .attr("x", cx)
            .attr("y", baseline - radius - 10)
            .attr("text-anchor", "middle")
            .attr("class", "size-legend-label")
            .text(marker.label);

        svg.append("text")
            .attr("x", cx)
            .attr("y", baseline + radius + 14)
            .attr("text-anchor", "middle")
            .attr("class", "size-legend-value")
            .text(formatLegendValue(sizeMetric, marker.value));
    });
}

// Update visualization
function updateVisualization(data, xAxis, yAxis, colorBy, sizeMetric) {
    // Update dimensions first
    updateSVGDimensions();
    
    const { xScale, yScale, sizeScale, sizeDomain } = createScales(data, xAxis, yAxis, sizeMetric);
    const colorFunction = createColorFunction(data, colorBy);
    
    createAxes(xScale, yScale, xAxis, yAxis);
    createColorLegend(data, colorBy);
    createSizeLegend(sizeScale, sizeMetric, sizeDomain, data);

    window.currentSizeMetric = sizeMetric;
    window.currentColorBy = colorBy;
    window.currentXAxis = xAxis;
    window.currentYAxis = yAxis;

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
        .attr("r", d => {
            const val = d[sizeMetric] > 0 ? d[sizeMetric] : sizeDomain[0];
            return sizeScale(val);
        })
        .attr("fill", colorFunction);

    enableMouseover()
}

// Event listeners for controls

function updateAxisDropdownStates() {
    const xSelect = document.getElementById("x-axis");
    const ySelect = document.getElementById("y-axis");

    const xVal = xSelect.value;
    const yVal = ySelect.value;

    // Reset all options
    [...xSelect.options].forEach(opt => opt.disabled = false);
    [...ySelect.options].forEach(opt => opt.disabled = false);

    // Disable same variable in opposite dropdown if it exists
    const yMatch = ySelect.querySelector(`option[value="${xVal}"]`);
    if (yMatch) yMatch.disabled = true;
    const xMatch = xSelect.querySelector(`option[value="${yVal}"]`);
    if (xMatch) xMatch.disabled = true;
}

function setupControls() {
    d3.select("#x-axis").on("change", function() {
        updateAxisDropdownStates();
        const xAxis = this.value;
        const yAxis = d3.select("#y-axis").property("value");
        const colorBy = d3.select("#color-by").property("value");
        const sizeBy = d3.select("#size-by").property("value");
        updateVisualization(window.currentData, xAxis, yAxis, colorBy, sizeBy);
    });

    d3.select("#y-axis").on("change", function() {
        updateAxisDropdownStates();
        const xAxis = d3.select("#x-axis").property("value");
        const yAxis = this.value;
        const colorBy = d3.select("#color-by").property("value");
        const sizeBy = d3.select("#size-by").property("value");
        updateVisualization(window.currentData, xAxis, yAxis, colorBy, sizeBy);
    });

    d3.select("#color-by").on("change", function() {
        const xAxis = d3.select("#x-axis").property("value");
        const yAxis = d3.select("#y-axis").property("value");
        const colorBy = this.value;
        const sizeBy = d3.select("#size-by").property("value");
        updateVisualization(window.currentData, xAxis, yAxis, colorBy, sizeBy);
    });

    d3.select("#size-by").on("change", function() {
        const xAxis = d3.select("#x-axis").property("value");
        const yAxis = d3.select("#y-axis").property("value");
        const colorBy = d3.select("#color-by").property("value");
        const sizeBy = this.value;
        updateVisualization(window.currentData, xAxis, yAxis, colorBy, sizeBy);
    });
}

// INFO PANEL CONTROLS
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
    d3.select("#x-axis").property("value", "sentiment");
    d3.select("#y-axis").property("value", "market_cap");
    d3.select("#color-by").property("value", "sentiment");
    d3.select("#size-by").property("value", "market_cap");
    
    setupControls();
    updateAxisDropdownStates();

    
    // Get current dropdown values and use them for initial visualization
    const xAxis = d3.select("#x-axis").property("value");
    const yAxis = d3.select("#y-axis").property("value");
    const colorBy = d3.select("#color-by").property("value");
    const sizeBy = d3.select("#size-by").property("value");
    updateVisualization(data, xAxis, yAxis, colorBy, sizeBy);

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
            const sizeBy = d3.select("#size-by").property("value");
            updateVisualization(window.currentData, xAxis, yAxis, colorBy, sizeBy);
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
    tooltip.style('opacity', 1).html(getTooltipHtml(d));
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
    tooltip.style('opacity', 1).html(getTooltipHtml(d));
    
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

function getTooltipHtml(d) {
    const sizeMetric = window.currentSizeMetric || 'market_cap';
    const sizeLabel = getAxisLabel(sizeMetric);
    const sizeValue = formatLegendValue(sizeMetric, d[sizeMetric]);

    return `
        <strong>${d.name || d.ticker}</strong><br/>
        Sector: ${d.sector || 'N/A'}<br/>
        CEO Approval: ${formatLegendValue('ceo_approval', d.ceo_approval)}<br/>
        Employee Rating: ${formatLegendValue('employee_rating', d.employee_rating)}<br/>
        Sentiment: ${formatLegendValue('sentiment', d.sentiment)}<br/>
        Market Cap: ${formatLegendValue('market_cap', d.market_cap)}<br/>
        Revenue: ${formatLegendValue('revenue', d.revenue)}<br/>
        Employees: ${formatLegendValue('employee_count', d.employee_count)}<br/>
        Bubble Size (${sizeLabel}): ${sizeValue}
    `;
}

function enableMouseover() {
    d3.selectAll('#scatterplot circle')
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("opacity", 1)
                .attr("stroke-width", 2);

            tooltip
                .style("opacity", 1)
                .html(getTooltipHtml(d));
        })
        .on("mousemove", function(event) {
            const tooltipWidth = tooltip.node().offsetWidth;
            const tooltipHeight = tooltip.node().offsetHeight;
        
            // Desired position near cursor
            let x = event.clientX + 12;
            let y = event.clientY - 30;

            // Keep tooltip on screen
            const maxX = window.innerWidth - tooltipWidth - 10;
            const maxY = window.innerHeight - tooltipHeight - 10;
            x = Math.min(Math.max(10, x), maxX);
            y = Math.min(Math.max(10, y), maxY);

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
    // Show popup
    const popup = document.getElementById("scatter-company-popup");
    popup.classList.remove("hidden");

    // Set logo
    const logo = document.getElementById("scatter-company-logo");
    logo.src = `dataset/logos/images/${d.ticker}.png`;
    logo.onerror = () => logo.style.display = "none";
    logo.style.display = "block";

    // Fill fields
    document.getElementById("info-company-name").textContent = d.name;
    document.getElementById("info-company-ticker").textContent = d.ticker;
    document.getElementById("info-company-sector").textContent = d.sector;
    document.getElementById("info-company-industry").textContent = d.industry;
    document.getElementById("info-company-ceo").textContent = formatLegendValue('ceo_approval', d.ceo_approval);
    document.getElementById("info-company-rating").textContent = formatLegendValue('employee_rating', d.employee_rating);

    document.getElementById("info-company-cap").textContent = formatLegendValue('market_cap', d.market_cap);
    document.getElementById("info-company-revenue").textContent = formatLegendValue('revenue', d.revenue);

    document.getElementById("info-company-pe").textContent = formatLegendValue('pe_ratio', d.pe_ratio);
    document.getElementById("info-company-sent").textContent = formatLegendValue('sentiment', d.sentiment);
    document.getElementById("info-company-emp").textContent = formatLegendValue('employee_count', d.employee_count);
}

document.getElementById("scatter-popup-close").onclick = () => {
    document.getElementById("scatter-company-popup").classList.add("hidden");
};
