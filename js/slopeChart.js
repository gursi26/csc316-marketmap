/**
 * SlopeChart
 *  - Renders a slope chart showing either roles (per company) or companies (per role).
 *
 * Constructor inputs:
 *  - parentElement: selector or DOM element of an <svg> used for rendering
 *  - data: array of salary rows (expects fields like Ticker, Role Name, Total Pay, Base Pay, Stock, Bonus, Role Rank)
 *  - companyInfo: array of company metadata rows (expects Ticker, Name, Industry)
 *
 * Behavior / outputs:
 *  - Keeps internal state (viewMode, selectedCompany/selectedRole, selectedIndustry)
 *  - Updates the DOM controls (#view-mode-select, #industry-select, #item-select) and redraws the chart
 */
class SlopeChart {
    /**
     * Create a SlopeChart instance.
     * @param {string|HTMLElement} parentElement - selector/element for the <svg>
     * @param {Array<Object>} data - cleaned salary dataset rows
     * @param {Array<Object>} companyInfo - company metadata rows
     */
    constructor(parentElement, data, companyInfo) {
        this.parentElement = parentElement;
        this.data = data;
        this.companyInfo = companyInfo;

        // UI state
        this.viewMode = 'role'; // 'company' or 'role'
        this.selectedCompany = null;
        this.selectedRole = null; // used when viewMode === 'role'

        // Interaction state
        this.lockedItem = null; // if an item is 'locked' (clicked)
        this.previousDistributionPath = null; // stores previous KDE path for smooth transitions

        // Derived mappings / helpers
        this.setupRoleColors();
        this.setupCompanyNameMap();

        // Initialize rendering and controls
        this.initVis();
    }

    /**
     * Initialize SVG sizing and controls.
     * Sets svg width/height and wires control dropdowns.
     */
    initVis() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.svg = d3.select(this.parentElement)
            // .attr("width", this.width)
            // .attr("height", this.height);
        
        // Setup company dropdown
        // Populate and wire the control dropdowns
        this.setupDropdown();
    }

    /**
     * Prepare a color scale for roles. This keeps coloring consistent
     * between left items (roles/companies) and rank bubbles.
     */
    setupRoleColors() {
        // Build color mapping for roles (used for consistent coloring throughout)
        const allRoles = [...new Set(this.data.map(d => d["Role Name"]))];
        this.roleColorScale = setupRoleColorScale(allRoles);
    }
    
    /**
     * Build quick lookup maps:
     *  - this.companyNameMap: ticker -> display name
     *  - this.companyIndustryMap: ticker -> industry string
     */
    setupCompanyNameMap() {
        // Create lookup maps: ticker -> display name and ticker -> industry
        this.companyNameMap = {};
        this.companyIndustryMap = {};
        this.companyInfo.forEach(company => {
            if (company.Ticker && company.Name) {
                this.companyNameMap[company.Ticker] = company.Name;
                this.companyIndustryMap[company.Ticker] = company.Industry || '';
            }
        });
    }

    /**
     * Populate and wire the UI dropdowns: view-mode and item-select
     * (which is contextual: company or role depending on viewMode).
     */
    setupDropdown() {
        const self = this;
        
        // Count data entries for each ticker and role for sorting
        const tickerCounts = {};
        const roleCounts = {};
        this.data.forEach(d => {
            tickerCounts[d.Ticker] = (tickerCounts[d.Ticker] || 0) + 1;
            roleCounts[d["Role Name"]] = (roleCounts[d["Role Name"]] || 0) + 1;
        });
        
        // Get all tickers and roles, sorted by data count (descending)
        const tickers = [...new Set(this.data.map(d => d.Ticker))]
            .sort((a, b) => tickerCounts[b] - tickerCounts[a]);
        const roles = [...new Set(this.data.map(d => d["Role Name"]))]
            .sort((a, b) => roleCounts[b] - roleCounts[a]);
        
        // Store for later use in updateItemDropdown
        this.sortedTickers = tickers;
        this.sortedRoles = roles;
        
        // Setup view mode dropdown (Company vs Role)
        const viewModeSelect = d3.select("#view-mode-select");
        viewModeSelect.on("change", function() {
            self.viewMode = this.value;
            self.updateItemDropdown();
            self.wrangleData();
        });
        
        // Setup main item dropdown. Its meaning changes with viewMode:
        // - viewMode === 'company' => item dropdown lists companies
        // - viewMode === 'role' => item dropdown lists roles
        const itemSelect = d3.select("#item-select");
        itemSelect.on("change", function() {
            if (self.viewMode === 'company') {
                self.selectedCompany = this.value;
                self.selectedRole = null;
            } else {
                self.selectedRole = this.value;
                self.selectedCompany = null;
            }
            self.wrangleData();
        });

        // Set initial selections (default to role view with first role)
        this.selectedRole = roles[0];

        // Populate initial dropdowns
        this.updateItemDropdown();
    }
    
    /**
     * Refresh the item-select options based on current viewMode.
     * - In company mode: item-select lists companies (sorted by data count)
     * - In role mode: item-select lists roles (sorted by data count)
     */
    updateItemDropdown() {
        const itemSelect = d3.select("#item-select");
        const itemLabel = d3.select("#item-label");
        const viewModeSelect = d3.select("#view-mode-select");
        const companyLogo = d3.select("#company-logo");
        
        // Update view mode dropdown to match current state
        viewModeSelect.property("value", this.viewMode);
        
        if (this.viewMode === 'company') {
            // Use pre-sorted tickers
            const tickers = this.sortedTickers;
            
            itemLabel.text("Company:");
            
            itemSelect.selectAll("option")
                .data(tickers)
                .join("option")
                .attr("value", d => d)
                .text(d => this.companyNameMap[d] || d);
            
            // Set to current company
            if (!this.selectedCompany || tickers.indexOf(this.selectedCompany) === -1) {
                this.selectedCompany = tickers[0];
            }
            itemSelect.property("value", this.selectedCompany);
            
            // Update and show company logo
            const logoPath = `../dataset/logos/images/${this.selectedCompany}.png`;
            companyLogo
                .attr("src", logoPath)
                .classed("visible", true)
                .on("error", function() {
                    // Hide logo if it fails to load
                    d3.select(this).classed("visible", false);
                });
        }
        else {
            // Use pre-sorted roles
            const roles = this.sortedRoles;
            
            itemLabel.text("Role:");
            
            itemSelect.selectAll("option")
                .data(roles)
                .join("option")
                .attr("value", d => d)
                .text(d => formatRoleName(d));
            
            // Set to current role
            if (!this.selectedRole || roles.indexOf(this.selectedRole) === -1) {
                this.selectedRole = roles[0];
            }
            itemSelect.property("value", this.selectedRole);
            
            // Hide logo in role view
            companyLogo.classed("visible", false);
        }
    }

    // Role filtering helper removed since the role dropdown UI was removed.

    

	wrangleData() {
        // Reset locked item when changing view
        this.lockedItem = null;
        
        // Update dropdowns to match current state
        this.updateItemDropdown();
        
        if (this.viewMode === 'company') {
            this.wrangleCompanyView();
        } else if (this.viewMode === 'role') {
            this.wrangleRoleView();
        }
    }
    
    /**
     * Build display data for company view.
     * Left items: roles within the selected company (avg comp)
     * Right items: flattened ranks across the company
     */
    wrangleCompanyView() {
        if (!this.selectedCompany) return;
        
        // Filter data for selected company
        const companyData = this.data.filter(d => d.Ticker === this.selectedCompany);
        
        // Group by role
        const roleMap = d3.group(companyData, d => d["Role Name"]);
            
        // Process roles
        const roles = Array.from(roleMap, ([roleName, rows]) => {
            // Filter out rows with 0 or empty pay BEFORE calculating averages
            const validRows = rows.filter(row => {
                const totalPay = +row["Total Pay"];
                return !isNaN(totalPay) && totalPay > 0;
            });
            
            return {
                name: roleName,
                companyName: this.selectedCompany,
                companyDisplayName: this.companyNameMap[this.selectedCompany] || this.selectedCompany,
                avgPay: d3.mean(validRows, d => +d["Total Pay"]),
                avgBase: d3.mean(validRows, d => +d["Base Pay"]),
                avgStock: d3.mean(validRows, d => +d["Stock"]),
                avgBonus: d3.mean(validRows, d => +d["Bonus"]),
                ranks: rows.map(row => {
                    const rankNum = +row["Role Rank"];
                    const rankName = row["Role Rank Name"] && row["Role Rank Name"].trim() 
                        ? row["Role Rank Name"] 
                        : `L${rankNum}`;
                    return {
                        companyName: this.selectedCompany,
                        companyDisplayName: this.companyNameMap[this.selectedCompany] || this.selectedCompany,
                        roleName: roleName,
                        rankName: rankName,
                        rank: rankNum,
                        totalPay: +row["Total Pay"],
                        basePay: +row["Base Pay"],
                        stock: +row["Stock"],
                        bonus: +row["Bonus"]
                    };
                }).sort((a, b) => a.rank - b.rank)
            };
        })
        .filter(r => !isNaN(r.avgPay) && r.avgPay > 0)
        .sort((a, b) => b.avgPay - a.avgPay); // Sort by average pay descending
        
        // Flatten all ranks and sort by total pay, filtering out 0 or empty pay
        const allRanks = roles.flatMap(role => role.ranks)
            .filter(r => !isNaN(r.totalPay) && r.totalPay > 0)
            .sort((a, b) => b.totalPay - a.totalPay); // Sort descending (highest at top)
        
        this.displayData = {
            viewMode: 'company',
            title: this.companyNameMap[this.selectedCompany] || this.selectedCompany,
            leftItems: roles,
            rightItems: allRanks
        };
        
        this.updateVis();
    }
    
    /**
     * Build display data for role view.
     * The resulting companies are sorted by average pay and limited to top 10.
     */
    wrangleRoleView() {
        if (!this.selectedRole) return;
        
        // Filter data for selected role
        const roleData = this.data.filter(d => d["Role Name"] === this.selectedRole);
        
        // Group by company
        const companyMap = d3.group(roleData, d => d.Ticker);
        
        // Process companies
        const companies = Array.from(companyMap, ([ticker, rows]) => {
            // Filter out rows with 0 or empty pay BEFORE calculating averages
            const validRows = rows.filter(row => {
                const totalPay = +row["Total Pay"];
                return !isNaN(totalPay) && totalPay > 0;
            });
            
            const companyDisplayName = this.companyNameMap[ticker] || ticker;
            
            return {
                name: ticker,
                displayName: companyDisplayName,
                roleName: this.selectedRole,
                avgPay: d3.mean(validRows, d => +d["Total Pay"]),
                avgBase: d3.mean(validRows, d => +d["Base Pay"]),
                avgStock: d3.mean(validRows, d => +d["Stock"]),
                avgBonus: d3.mean(validRows, d => +d["Bonus"]),
                ranks: rows.map(row => {
                    const rankNum = +row["Role Rank"];
                    const rankName = row["Role Rank Name"] && row["Role Rank Name"].trim() 
                        ? row["Role Rank Name"] 
                        : `L${rankNum}`;
                    return {
                        companyName: ticker,
                        companyDisplayName: companyDisplayName,
                        roleName: this.selectedRole,
                        rankName: rankName,
                        rank: rankNum,
                        totalPay: +row["Total Pay"],
                        basePay: +row["Base Pay"],
                        stock: +row["Stock"],
                        bonus: +row["Bonus"]
                    };
                }).sort((a, b) => a.rank - b.rank)
            };
        })
        .filter(c => !isNaN(c.avgPay) && c.avgPay > 0)
    .sort((a, b) => b.avgPay - a.avgPay)
    .slice(0, 10); // Top 10 companies only (if industry has many companies, show top 10)
        
        // Flatten all ranks for these top 10 companies
        const allRanks = companies.flatMap(company => company.ranks)
            .filter(r => !isNaN(r.totalPay) && r.totalPay > 0)
            .sort((a, b) => b.totalPay - a.totalPay);
        
        this.displayData = {
            viewMode: 'role',
            title: formatRoleName(this.selectedRole),
            leftItems: companies,
            rightItems: allRanks
        };
        
        this.updateVis();
    }

    updateVis() {
        // Clear and redraw
        this.svg.selectAll("*").remove();
        this.drawVisualization();
    }
    
    /**
     * Core draw routine: lays out axes, titles, distributions, lines and bubbles.
     * This method assumes this.displayData has been prepared by a wrangle* method.
     */
    drawVisualization() {
        const { viewMode, title, leftItems, rightItems } = this.displayData;
        
        if (!leftItems.length || !rightItems.length) return;
        
        const c = SLOPE_CHART_CONSTANTS;
        
        // Calculate vertical offset to center the chart
        // Total content height from title top (22) to instructional text bottom
        const titleTop = 22;
        const instructionalTextBottom = this.height - c.bottomMargin + 40 + c.instructionalTextLineSpacing + 5;
        const totalContentHeight = instructionalTextBottom - titleTop;
        const verticalOffset = (this.height - totalContentHeight) / 2 - titleTop;
        
        // Calculate the width needed for the chart (30% wider)
        const chartWidth = this.width * 0.91; // 0.7 * 1.3 = 0.91
        const chartHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Center the chart horizontally
        const chartCenterX = this.width / 2;
        const leftX = chartCenterX - chartWidth / 2 + c.leftMargin;
        const rightX = chartCenterX + chartWidth / 2 - c.rightMargin;
        
        // Calculate available height for plotting (adjusted for vertical centering)
        const adjustedTopMargin = c.topMargin + verticalOffset;
        const plotHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Create a unified scale for both left and right items
        const maxLeftPay = d3.max(leftItems, d => d.avgPay);
        const maxRightPay = d3.max(rightItems, d => d.totalPay);
        const maxPay = Math.max(maxLeftPay, maxRightPay);
        
        const payScale = d3.scaleLinear()
            .domain([0, maxPay])
            .range([adjustedTopMargin + plotHeight, adjustedTopMargin]);
        
        const leftScale = payScale;
        const rightScale = payScale;
        
        // Draw vertical lines
        this.drawVerticalLines(leftX, rightX, c, verticalOffset);
        
        // Draw axis and grid
        this.drawAxisAndGrid(payScale, leftX, rightX, c, verticalOffset);
        
        // Draw titles
        this.drawTitles(leftX, rightX, title, viewMode, c, verticalOffset);
        
        // Draw rank distribution
        this.drawRankDistribution(rightItems, rightScale, rightX, c);
        
        // Draw connecting lines
        this.drawConnectionLines(leftItems, rightItems, leftScale, rightScale, leftX, rightX, viewMode, c);
        
        // Draw left dots (roles or companies)
        this.drawLeftDots(leftItems, leftScale, leftX, viewMode, c);
        
        // Draw right dots (ranks)
        this.drawRightDots(rightItems, rightScale, rightX, viewMode, c);
        
        // Render bubbles
        this.renderBubbles(leftItems, rightItems, leftScale, rightScale, leftX, rightX, viewMode);
        
        // Draw instructional text at the bottom
        this.drawInstructionalText(leftX, viewMode, c, verticalOffset);
        
        // Add click handler to SVG background to unlock
        this.svg.on("click", () => {
            if (this.lockedItem) {
                this.lockedItem = null;
                resetHighlight(this.svg);
            }
        });
    }

    drawVerticalLines(leftX, rightX, c, verticalOffset = 0) {
        this.svg.append("line")
            .attr("x1", leftX)
            .attr("y1", c.topMargin + verticalOffset)
            .attr("x2", leftX)
            .attr("y2", this.height - c.bottomMargin + verticalOffset)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2);
        
        this.svg.append("line")
            .attr("x1", rightX)
            .attr("y1", c.topMargin + verticalOffset)
            .attr("x2", rightX)
            .attr("y2", this.height - c.bottomMargin + verticalOffset)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2);
    }

    drawAxisAndGrid(payScale, leftX, rightX, c, verticalOffset = 0) {
        // Create axis
        const yAxis = d3.axisLeft(payScale)
            .ticks(10)
            .tickFormat(d => {
                if (d >= 1000000) {
                    return `$${(d / 1000000).toFixed(1)}M`;
                } else {
                    return `$${(d / 1000).toFixed(0)}k`;
                }
            });
        
        // Add horizontal grid lines FIRST so axis labels appear on top
        const gridLines = payScale.ticks(10);
        gridLines.forEach(tick => {
            const y = payScale(tick);
            this.svg.append("line")
                .attr("x1", leftX)
                .attr("y1", y)
                .attr("x2", rightX)
                .attr("y2", y)
                .attr("stroke", "#555")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");
        });
        
        // Draw axis in the middle (AFTER gridlines so labels are on top)
        const axisX = (leftX + rightX) / 2;
        
        const axisGroup = this.svg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${axisX}, 0)`)
            .call(yAxis);
        
        // Add background rectangles behind text labels
        axisGroup.selectAll("text").each(function() {
            const textNode = d3.select(this);
            const bbox = this.getBBox();
            
            // Insert rect before text
            d3.select(this.parentNode).insert("rect", "text")
                .attr("x", bbox.x - 2)
                .attr("y", bbox.y - 1)
                .attr("width", bbox.width + 4)
                .attr("height", bbox.height + 2)
                .attr("fill", "#1a1a1a");
        });
        
        // Style text
        axisGroup.selectAll("text")
            .style("font-size", `${c.yAxisFontSize}px`)
            .style("fill", "#ccc")
            .style("opacity", c.yAxisOpacity)
            .style("font-weight", c.yAxisFontWeight);
        
        // Style the axis
        this.svg.selectAll(".y-axis path, .y-axis line")
            .style("stroke", "#666")
            .style("stroke-width", 1);
    }

    drawTitles(leftX, rightX, title, viewMode, c, verticalOffset = 0) {
        const rightLabel = 'Ranks (Total Comp)';
        
        // Handle left label with potential wrapping for role view
        if (viewMode === 'company') {
            this.svg.append("text")
                .attr("x", leftX)
                .attr("y", c.topMargin - 30 + verticalOffset)
                .attr("text-anchor", "middle")
                .attr("font-size", c.titleFontSize)
                .attr("font-weight", "bold")
                .attr("font-family", "Work Sans")
                .attr("fill", "#e0e0e0")
                .text('Roles (Avg Comp)');
        } else {
            // Role view: display "Top 10 Companies (Avg Comp)" on two lines
            this.svg.append("text")
                .attr("x", leftX)
                .attr("y", c.topMargin - 38 + verticalOffset)
                .attr("text-anchor", "middle")
                .attr("font-size", c.titleFontSize)
                .attr("font-weight", "bold")
                .attr("font-family", "Work Sans")
                .attr("fill", "#e0e0e0")
                .text('Top 10 Companies');
            
            this.svg.append("text")
                .attr("x", leftX)
                .attr("y", c.topMargin - 20 + verticalOffset)
                .attr("text-anchor", "middle")
                .attr("font-size", c.titleFontSize)
                .attr("font-weight", "bold")
                .attr("font-family", "Work Sans")
                .attr("fill", "#e0e0e0")
                .text('(Avg Comp)');
        }
        
        this.svg.append("text")
            .attr("x", rightX)
            .attr("y", c.topMargin - 30 + verticalOffset)
            .attr("text-anchor", "middle")
            .attr("font-size", c.titleFontSize)
            .attr("font-weight", "bold")
                .attr("font-family", "Work Sans")
            .attr("fill", "#e0e0e0")
            .text(rightLabel);
        
        // Calculate the center axis position
        const axisX = (leftX + rightX) / 2;
        
        // Draw the main chart title (static)
        const mainTitleY = 10 + verticalOffset;
        const subtitleY = mainTitleY + c.chartTitleSpacing;
        
        const mainTitleText = this.svg.append("text")
            .attr("class", "chart-main-title")
            .attr("x", axisX)
            .attr("y", mainTitleY)
            .attr("text-anchor", "middle")
            .attr("font-size", c.chartMainTitleFontSize)
            .attr("font-weight", "bold")
                .attr("font-family", "Work Sans")
            .attr("fill", "#e0e0e0")
            .text(c.chartMainTitle);
        
        // Calculate position for info icon (to the right of title)
        const titleBBox = mainTitleText.node().getBBox();
        const iconX = titleBBox.x + titleBBox.width + c.infoIconOffset;
        const iconY = mainTitleY;
        
        // Draw info icon group
        const infoIconGroup = this.svg.append("g")
            .attr("class", "info-icon")
            .style("cursor", "pointer");
        
        // Draw invisible circle for larger hover area
        infoIconGroup.append("circle")
            .attr("cx", iconX)
            .attr("cy", iconY - c.infoIconRadius / 2)
            .attr("r", c.infoIconRadius + 2)
            .attr("fill", "transparent")
            .attr("stroke", "none");
        
        // Draw visible circle
        infoIconGroup.append("circle")
            .attr("cx", iconX)
            .attr("cy", iconY - c.infoIconRadius / 2)
            .attr("r", c.infoIconRadius)
            .attr("fill", "none")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2);
        
        // Draw "i" text
        infoIconGroup.append("text")
            .attr("x", iconX)
            .attr("y", iconY - c.infoIconRadius / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", c.infoIconRadius * 1.4)
            .attr("font-weight", "bold")
                .attr("font-family", "Work Sans")
            .attr("font-style", "italic")
            .attr("fill", "#ffffff")
            .text("i")
            .style("pointer-events", "none");
        
        // Add hover handlers for info icon
        infoIconGroup
            .on("mouseenter", (event) => {
                showInfoPopup(c.infoPopupText, event.clientX, event.clientY);
            })
            .on("mousemove", (event) => {
                updateInfoPopupPosition(event.clientX, event.clientY);
            })
            .on("mouseleave", () => {
                hideInfoPopup();
            });
        
        // Animation removed - dropdowns now handle the display
    }

    drawInstructionalText(leftX, viewMode, c, verticalOffset = 0) {
        const bottomY = this.height - c.bottomMargin + 40 + verticalOffset;
        
        // Get appropriate text based on view mode
        const line1Text = viewMode === 'company' ? c.instructionalTextLine1Company : c.instructionalTextLine1Role;
        
        // First line
        this.svg.append("text")
            .attr("class", "instructional-text")
            .attr("x", leftX)
            .attr("y", bottomY)
            .attr("text-anchor", "start")
            .attr("font-size", c.instructionalTextFontSize)
            .attr("font-style", "italic")
            .attr("fill", "#999")
            .text(line1Text);
    }

    drawRankDistribution(ranks, rankScale, rightX, c) {
        // Extract total pay values
        const payValues = ranks.map(d => d.totalPay);
        
        // Get the axis range (0 to max value on axis)
        const maxPay = d3.max(payValues);
        
        // Create thresholds from 0 to maxPay
        const thresholds = d3.range(0, maxPay, maxPay / 150);
        
        // Calculate bandwidth for kernel density estimation
        const bandwidth = maxPay / 15;
        
        // Calculate density
        const density = kernelDensityEstimator(kernelGaussian(bandwidth), thresholds)(payValues);
        
        // Create scale for density (horizontal extent to the left of rank line)
        const maxDensity = d3.max(density, d => d[1]);
        const densityScale = d3.scaleLinear()
            .domain([0, maxDensity])
            .range([rightX, rightX - 300]); // Extend 300px to the left for more variation
        
        // Create the area generator (rotated - horizontal instead of vertical)
        const area = d3.area()
            .x0(rightX) // Right edge (baseline)
            .x1(d => densityScale(d[1])) // Left extent based on density
            .y(d => rankScale(d[0])) // Vertical position based on pay
            .curve(d3.curveBasis);
        
        // Generate the new path
        const newPath = area(density);
        
        // Draw the distribution area
        const path = this.svg.append("path")
            .attr("class", "rank-distribution")
            .attr("fill", "#4A90E2")
            .attr("fill-opacity", 0.3)
            .attr("stroke", "#6BA8E5")
            .attr("stroke-width", 1.5);
        
        // Draw the path
        path.attr("d", newPath);
        
        // Store this path for next transition
        this.previousDistributionPath = newPath;
    }

    drawConnectionLines(leftItems, rightItems, leftScale, rightScale, leftX, rightX, viewMode, c) {
        leftItems.forEach(leftItem => {
            const leftY = leftScale(leftItem.avgPay);
            const itemColor = this.roleColorScale(leftItem.name);
            
            leftItem.ranks.forEach(rank => {
                let rankIndex;
                if (viewMode === 'company') {
                    rankIndex = rightItems.findIndex(r => 
                        r.roleName === rank.roleName && 
                        r.rankName === rank.rankName && 
                        r.totalPay === rank.totalPay
                    );
                } else {
                    rankIndex = rightItems.findIndex(r => 
                        r.companyName === rank.companyName && 
                        r.rankName === rank.rankName && 
                        r.totalPay === rank.totalPay
                    );
                }
                
                if (rankIndex !== -1) {
                    const rightY = rightScale(rightItems[rankIndex].totalPay);
                    
                    this.svg.append("line")
                        .attr("class", "connection-line")
                        .attr("data-left-item", leftItem.name)
                        .attr("data-rank-index", rankIndex)
                        .attr("x1", leftX)
                        .attr("y1", leftY)
                        .attr("x2", rightX)
                        .attr("y2", rightY)
                        .attr("stroke", itemColor)
                        .attr("stroke-opacity", c.lineOpacity)
                        .attr("stroke-width", c.lineWidth);
                }
            });
        });
    }

    drawLeftDots(leftItems, leftScale, leftX, viewMode, c) {
        const self = this;
        this.svg.selectAll(".left-dot")
            .data(leftItems)
            .join("circle")
            .attr("class", "left-dot")
            .attr("cx", leftX)
            .attr("cy", d => leftScale(d.avgPay))
            .attr("r", c.dotRadius)
            .attr("fill", d => this.roleColorScale(d.name))
            .attr("stroke", "#1a1a1a")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (self.lockedItem === d.name) {
                    self.lockedItem = null;
                    resetHighlight(self.svg);
                } else {
                    self.lockedItem = d.name;
                    highlightLeftItem(self.svg, d.name, self.displayData.rightItems, viewMode);
                }
                event.stopPropagation();
            })
            .on("dblclick", (event, d) => {
                event.stopPropagation();
                hideTooltip();
                
                if (viewMode === 'company') {
                    // Switch to role view
                    self.selectedRole = d.name;
                    self.viewMode = 'role';
                    self.wrangleData();
                } else {
                    // Switch to company view
                    self.selectedCompany = d.name;
                    self.viewMode = 'company';
                    self.wrangleData();
                }
            })
            .on("mouseenter", (event, d) => {
                if (!self.lockedItem) {
                    highlightLeftItem(self.svg, d.name, self.displayData.rightItems, viewMode);
                }
                showRoleTooltip(d, event.clientX, event.clientY);
            })
            .on("mousemove", (event) => {
                updateTooltipPosition(event.clientX, event.clientY);
            })
            .on("mouseleave", () => {
                if (!self.lockedItem) {
                    resetHighlight(self.svg);
                }
                hideTooltip();
            });
    }

    drawRightDots(rightItems, rightScale, rightX, viewMode, c) {
        this.svg.selectAll(".right-dot")
            .data(rightItems)
            .join("circle")
            .attr("class", "right-dot")
            .attr("cx", rightX)
            .attr("cy", d => rightScale(d.totalPay))
            .attr("r", c.dotRadius)
            .attr("fill", d => {
                const key = viewMode === 'company' ? d.roleName : d.companyName;
                return this.roleColorScale(key);
            })
            .attr("stroke", "#1a1a1a")
            .attr("stroke-width", 2)
            .style("cursor", "pointer");
    }

    renderBubbles(leftItems, rightItems, leftScale, rightScale, leftX, rightX, viewMode) {
        const self = this;
        
        // Create event handlers for left bubbles
        const leftBubbleHandlers = {
            onClick: (event, item) => {
                if (self.lockedItem === item.name) {
                    self.lockedItem = null;
                    resetHighlight(self.svg);
                } else {
                    self.lockedItem = item.name;
                    highlightLeftItem(self.svg, item.name, self.displayData.rightItems, viewMode);
                }
                event.stopPropagation();
            },
            onDblClick: (event, item) => {
                event.stopPropagation();
                hideTooltip();
                
                if (viewMode === 'company') {
                    // Switch to role view
                    self.selectedRole = item.name;
                    self.viewMode = 'role';
                    self.wrangleData();
                } else {
                    // Switch to company view
                    self.selectedCompany = item.name;
                    self.viewMode = 'company';
                    self.wrangleData();
                }
            },
            onMouseEnter: (event, item) => {
                if (!self.lockedItem) {
                    highlightLeftItem(self.svg, item.name, self.displayData.rightItems, viewMode);
                }
            },
            onMouseLeave: () => {
                if (!self.lockedItem) {
                    resetHighlight(self.svg);
                }
            }
        };
        
        // Render left bubbles (roles or companies)
        renderRoleBubbles(
            this.svg,
            leftItems,
            leftScale,
            this.roleColorScale,
            leftX,
            leftBubbleHandlers,
            viewMode
        );
        
        // Render right bubbles (ranks)
        renderRankBubbles(
            this.svg,
            rightItems,
            rightScale,
            this.roleColorScale,
            rightX,
            viewMode
        );
    }
}

