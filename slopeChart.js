class SlopeChart {
    constructor(parentElement, data, companyInfo) {
		this.parentElement = parentElement;
        this.data = data;
        this.companyInfo = companyInfo;
        this.viewMode = 'company'; // 'company' or 'role'
        this.selectedCompany = null;
        this.selectedRole = null;
        this.lockedItem = null; // Track if a role/company is locked/frozen
        this.initVis();
        this.setupRoleColors();
        this.setupCompanyNameMap();
    }

	initVis() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.svg = d3.select(this.parentElement)
            .attr("width", this.width)
            .attr("height", this.height);
        
        // Setup company dropdown
        this.setupDropdown();
    }

    setupRoleColors() {
        // Get all unique roles across all data
        const allRoles = [...new Set(this.data.map(d => d["Role Name"]))];
        this.roleColorScale = setupRoleColorScale(allRoles);
    }
    
    setupCompanyNameMap() {
        // Create a mapping from ticker to company name
        this.companyNameMap = {};
        this.companyInfo.forEach(company => {
            this.companyNameMap[company.Ticker] = company.Name;
        });
    }

    setupDropdown() {
        const self = this;
        
        // Get all tickers and roles
        const tickers = [...new Set(this.data.map(d => d.Ticker))].sort();
        const roles = [...new Set(this.data.map(d => d["Role Name"]))].sort();
        
        // Setup view mode dropdown
        const viewModeSelect = d3.select("#view-mode-select");
        viewModeSelect.on("change", function() {
            self.viewMode = this.value;
            self.updateItemDropdown();
            self.wrangleData();
        });
        
        // Setup item dropdown
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
        
        // Set initial company
        this.selectedCompany = tickers[0];
        
        // Populate initial dropdown
        this.updateItemDropdown();
    }
    
    updateItemDropdown() {
        const itemSelect = d3.select("#item-select");
        const itemLabel = d3.select("#item-label");
        const viewModeSelect = d3.select("#view-mode-select");
        
        // Update view mode dropdown to match current state
        viewModeSelect.property("value", this.viewMode);
        
        if (this.viewMode === 'company') {
            const tickers = [...new Set(this.data.map(d => d.Ticker))].sort();
            
            itemLabel.text("Company:");
            
            itemSelect.selectAll("option")
                .data(tickers)
                .join("option")
                .attr("value", d => d)
                .text(d => d);
            
            // Set to current company
            if (!this.selectedCompany || tickers.indexOf(this.selectedCompany) === -1) {
                this.selectedCompany = tickers[0];
            }
            itemSelect.property("value", this.selectedCompany);
            
        } else {
            const roles = [...new Set(this.data.map(d => d["Role Name"]))].sort();
            
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
        }
    }

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
                avgPay: d3.mean(validRows, d => +d["Total Pay"]),
                avgBase: d3.mean(validRows, d => +d["Base Pay"]),
                avgStock: d3.mean(validRows, d => +d["Stock"]),
                avgBonus: d3.mean(validRows, d => +d["Bonus"]),
                ranks: rows.map(row => ({
                    roleName: roleName,
                    rankName: row["Role Rank Name"],
                    rank: +row["Role Rank"],
                    totalPay: +row["Total Pay"],
                    basePay: +row["Base Pay"],
                    stock: +row["Stock"],
                    bonus: +row["Bonus"]
                })).sort((a, b) => a.rank - b.rank)
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
            title: this.selectedCompany,
            leftItems: roles,
            rightItems: allRanks
        };
        
        this.updateVis();
    }
    
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
            
            return {
                name: ticker,
                displayName: this.companyNameMap[ticker] || ticker,
                avgPay: d3.mean(validRows, d => +d["Total Pay"]),
                avgBase: d3.mean(validRows, d => +d["Base Pay"]),
                avgStock: d3.mean(validRows, d => +d["Stock"]),
                avgBonus: d3.mean(validRows, d => +d["Bonus"]),
                ranks: rows.map(row => ({
                    companyName: ticker,
                    rankName: row["Role Rank Name"],
                    rank: +row["Role Rank"],
                    totalPay: +row["Total Pay"],
                    basePay: +row["Base Pay"],
                    stock: +row["Stock"],
                    bonus: +row["Bonus"]
                })).sort((a, b) => a.rank - b.rank)
            };
        })
        .filter(c => !isNaN(c.avgPay) && c.avgPay > 0)
        .sort((a, b) => b.avgPay - a.avgPay)
        .slice(0, 10); // Top 10 companies only
        
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
        this.svg.selectAll("*").remove();
        
        const { viewMode, title, leftItems, rightItems } = this.displayData;
        
        if (!leftItems.length || !rightItems.length) return;
        
        const c = SLOPE_CHART_CONSTANTS;
        
        // Calculate the width needed for the chart (30% wider)
        const chartWidth = this.width * 0.91; // 0.7 * 1.3 = 0.91
        const chartHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Center the chart horizontally
        const chartCenterX = this.width / 2;
        const leftX = chartCenterX - chartWidth / 2 + c.leftMargin;
        const rightX = chartCenterX + chartWidth / 2 - c.rightMargin;
        
        // Calculate available height for plotting
        const plotHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Create a unified scale for both left and right items
        const maxLeftPay = d3.max(leftItems, d => d.avgPay);
        const maxRightPay = d3.max(rightItems, d => d.totalPay);
        const maxPay = Math.max(maxLeftPay, maxRightPay);
        
        const payScale = d3.scaleLinear()
            .domain([0, maxPay])
            .range([c.topMargin + plotHeight, c.topMargin]);
        
        const leftScale = payScale;
        const rightScale = payScale;
        
        // Draw vertical lines
        this.drawVerticalLines(leftX, rightX, c);
        
        // Draw axis and grid
        this.drawAxisAndGrid(payScale, leftX, rightX, c);
        
        // Draw titles
        this.drawTitles(leftX, rightX, title, viewMode, c);
        
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
        
        // Add click handler to SVG background to unlock
        this.svg.on("click", () => {
            if (this.lockedItem) {
                this.lockedItem = null;
                resetHighlight(this.svg);
            }
        });
    }

    drawVerticalLines(leftX, rightX, c) {
        this.svg.append("line")
            .attr("x1", leftX)
            .attr("y1", c.topMargin)
            .attr("x2", leftX)
            .attr("y2", this.height - c.bottomMargin)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2);
        
        this.svg.append("line")
            .attr("x1", rightX)
            .attr("y1", c.topMargin)
            .attr("x2", rightX)
            .attr("y2", this.height - c.bottomMargin)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2);
    }

    drawAxisAndGrid(payScale, leftX, rightX, c) {
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
            .style("font-size", "11px")
            .style("fill", "#ccc");
        
        // Style the axis
        this.svg.selectAll(".y-axis path, .y-axis line")
            .style("stroke", "#666")
            .style("stroke-width", 1);
    }

    drawTitles(leftX, rightX, title, viewMode, c) {
        const leftLabel = viewMode === 'company' ? 'Roles (Avg Comp)' : 'Companies (Avg Comp)';
        const rightLabel = 'Ranks (Total Comp)';
        
        this.svg.append("text")
            .attr("x", leftX)
            .attr("y", c.topMargin - 30)
            .attr("text-anchor", "middle")
            .attr("font-size", c.titleFontSize)
            .attr("font-weight", "bold")
            .attr("fill", "#e0e0e0")
            .text(leftLabel);
        
        this.svg.append("text")
            .attr("x", rightX)
            .attr("y", c.topMargin - 30)
            .attr("text-anchor", "middle")
            .attr("font-size", c.titleFontSize)
            .attr("font-weight", "bold")
            .attr("fill", "#e0e0e0")
            .text(rightLabel);
        
        // Calculate the center axis position
        const axisX = (leftX + rightX) / 2;
        
        this.svg.append("text")
            .attr("x", axisX)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .attr("font-size", 24)
            .attr("font-weight", "bold")
            .attr("fill", "#e0e0e0")
            .text(title);
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
        
        // Draw the distribution area
        this.svg.append("path")
            .datum(density)
            .attr("class", "rank-distribution")
            .attr("d", area)
            .attr("fill", "#4A90E2")
            .attr("fill-opacity", 0.3)
            .attr("stroke", "#6BA8E5")
            .attr("stroke-width", 1.5);
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
            leftBubbleHandlers
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

