class SlopeChart {
    constructor(parentElement, data) {
		this.parentElement = parentElement;
        this.data = data;
        this.selectedCompany = null;
        this.lockedRole = null; // Track if a role is locked/frozen
        this.initVis();
        this.setupRoleColors();
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

    setupDropdown() {
        const tickers = [...new Set(this.data.map(d => d.Ticker))].sort();
        
        const dropdown = d3.select("#company-select");
        
        dropdown.selectAll("option")
            .data(tickers)
            .join("option")
            .attr("value", d => d)
            .text(d => d);
        
        // Set initial company
        this.selectedCompany = tickers[0];
        
        // Add event listener
        dropdown.on("change", (event) => {
            this.selectedCompany = event.target.value;
            this.wrangleData();
        });
    }

	wrangleData() {
        if (!this.selectedCompany) return;
        
        // Reset locked role when changing companies
        this.lockedRole = null;
        
        // Filter data for selected company
        const companyData = this.data.filter(d => d.Ticker === this.selectedCompany);
        
        // Group by role
        const roleMap = d3.group(companyData, d => d["Role Name"]);
            
        // Process roles
        const roles = Array.from(roleMap, ([roleName, rows]) => ({
            name: roleName,
            avgPay: d3.mean(rows, d => +d["Total Pay"]),
            avgBase: d3.mean(rows, d => +d["Base Pay"]),
            avgStock: d3.mean(rows, d => +d["Stock"]),
            avgBonus: d3.mean(rows, d => +d["Bonus"]),
            ranks: rows.map(row => ({
                roleName: roleName,
                rankName: row["Role Rank Name"],
                rank: +row["Role Rank"],
                totalPay: +row["Total Pay"],
                basePay: +row["Base Pay"],
                stock: +row["Stock"],
                bonus: +row["Bonus"]
            })).sort((a, b) => a.rank - b.rank)
        }))
        .filter(r => !isNaN(r.avgPay))
        .sort((a, b) => b.avgPay - a.avgPay); // Sort by average pay descending
        
        // Flatten all ranks and sort by total pay, filtering out 0 or empty pay
        const allRanks = roles.flatMap(role => role.ranks)
            .filter(r => !isNaN(r.totalPay) && r.totalPay > 0)
            .sort((a, b) => b.totalPay - a.totalPay); // Sort descending (highest at top)
        
        this.displayData = {
            company: this.selectedCompany,
            roles: roles,
            ranks: allRanks
        };
        
        this.updateVis();
    }

    updateVis() {
        this.svg.selectAll("*").remove();
        
        const { roles, ranks, company } = this.displayData;
        
        if (!roles.length || !ranks.length) return;
        
        const c = SLOPE_CHART_CONSTANTS;
        
        // Calculate positions for the two vertical lines
        const leftX = c.leftMargin;
        const rightX = this.width * 0.65;
        
        // Calculate available height for plotting
        const plotHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Create a unified scale for both roles and ranks
        const maxRolePay = d3.max(roles, d => d.avgPay);
        const maxRankPay = d3.max(ranks, d => d.totalPay);
        const maxPay = Math.max(maxRolePay, maxRankPay);
        
        const payScale = d3.scaleLinear()
            .domain([0, maxPay])
            .range([c.topMargin + plotHeight, c.topMargin]);
        
        const roleScale = payScale;
        const rankScale = payScale;
        
        // Draw vertical lines
        this.drawVerticalLines(leftX, rightX, c);
        
        // Draw axis and grid
        this.drawAxisAndGrid(payScale, leftX, rightX, c);
        
        // Draw titles
        this.drawTitles(leftX, rightX, company, c);
        
        // Draw connecting lines from roles to ranks
        this.drawConnectionLines(roles, ranks, roleScale, rankScale, leftX, rightX, c);
        
        // Draw role dots
        this.drawRoleDots(roles, roleScale, leftX, c);
        
        // Draw rank dots
        this.drawRankDots(ranks, rankScale, rightX, c);
        
        // Render role and rank bubbles
        this.renderBubbles(roles, ranks, roleScale, rankScale, leftX, rightX);
        
        // Add click handler to SVG background to unlock
        this.svg.on("click", () => {
            if (this.lockedRole) {
                this.lockedRole = null;
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
            .attr("stroke", "#333")
            .attr("stroke-width", 2);
        
        this.svg.append("line")
            .attr("x1", rightX)
            .attr("y1", c.topMargin)
            .attr("x2", rightX)
            .attr("y2", this.height - c.bottomMargin)
            .attr("stroke", "#333")
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
        
        // Draw axis in the middle
        const axisX = (leftX + rightX) / 2;
        
        this.svg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${axisX}, 0)`)
            .call(yAxis)
            .selectAll("text")
            .style("font-size", "11px")
            .style("fill", "#666");
        
        // Style the axis
        this.svg.selectAll(".y-axis path, .y-axis line")
            .style("stroke", "#ddd")
            .style("stroke-width", 1);
        
        // Add horizontal grid lines
        const gridLines = payScale.ticks(10);
        gridLines.forEach(tick => {
            const y = payScale(tick);
            this.svg.append("line")
                .attr("x1", leftX)
                .attr("y1", y)
                .attr("x2", rightX)
                .attr("y2", y)
                .attr("stroke", "#f0f0f0")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");
        });
    }

    drawTitles(leftX, rightX, company, c) {
        this.svg.append("text")
            .attr("x", leftX)
            .attr("y", c.topMargin - 30)
            .attr("text-anchor", "middle")
            .attr("font-size", c.titleFontSize)
            .attr("font-weight", "bold")
            .text("Roles (by Avg Pay)");
        
        this.svg.append("text")
            .attr("x", rightX)
            .attr("y", c.topMargin - 30)
            .attr("text-anchor", "middle")
            .attr("font-size", c.titleFontSize)
            .attr("font-weight", "bold")
            .text("Ranks (by Total Pay)");
        
        this.svg.append("text")
            .attr("x", this.width / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .attr("font-size", 24)
            .attr("font-weight", "bold")
            .text(company);
    }

    drawConnectionLines(roles, ranks, roleScale, rankScale, leftX, rightX, c) {
        roles.forEach(role => {
            const roleY = roleScale(role.avgPay);
            const roleColor = this.roleColorScale(role.name);
            
            role.ranks.forEach(rank => {
                const rankIndex = ranks.findIndex(r => 
                    r.roleName === rank.roleName && 
                    r.rankName === rank.rankName && 
                    r.totalPay === rank.totalPay
                );
                
                if (rankIndex !== -1) {
                    const rankY = rankScale(ranks[rankIndex].totalPay);
                    
                    this.svg.append("line")
                        .attr("class", "connection-line")
                        .attr("data-role", role.name)
                        .attr("data-rank-index", rankIndex)
                        .attr("x1", leftX)
                        .attr("y1", roleY)
                        .attr("x2", rightX)
                        .attr("y2", rankY)
                        .attr("stroke", roleColor)
                        .attr("stroke-opacity", c.lineOpacity)
                        .attr("stroke-width", c.lineWidth);
                }
            });
        });
    }

    drawRoleDots(roles, roleScale, leftX, c) {
        this.svg.selectAll(".role-dot")
            .data(roles)
            .join("circle")
            .attr("class", "role-dot")
            .attr("cx", leftX)
            .attr("cy", d => roleScale(d.avgPay))
            .attr("r", c.dotRadius)
            .attr("fill", d => this.roleColorScale(d.name))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (this.lockedRole === d.name) {
                    this.lockedRole = null;
                    resetHighlight(this.svg);
                } else {
                    this.lockedRole = d.name;
                    highlightRole(this.svg, d.name, this.displayData.ranks);
                }
                event.stopPropagation();
            })
            .on("mouseenter", (event, d) => {
                if (!this.lockedRole) {
                    highlightRole(this.svg, d.name, this.displayData.ranks);
                }
            })
            .on("mouseleave", () => {
                if (!this.lockedRole) {
                    resetHighlight(this.svg);
                }
            });
    }

    drawRankDots(ranks, rankScale, rightX, c) {
        this.svg.selectAll(".rank-dot")
            .data(ranks)
            .join("circle")
            .attr("class", "rank-dot")
            .attr("cx", rightX)
            .attr("cy", d => rankScale(d.totalPay))
            .attr("r", c.dotRadius)
            .attr("fill", d => this.roleColorScale(d.roleName))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("cursor", "pointer");
    }

    renderBubbles(roles, ranks, roleScale, rankScale, leftX, rightX) {
        const self = this;
        
        // Create event handlers for role bubbles
        const roleBubbleHandlers = {
            onClick: (event, role) => {
                if (self.lockedRole === role.name) {
                    self.lockedRole = null;
                    resetHighlight(self.svg);
                } else {
                    self.lockedRole = role.name;
                    highlightRole(self.svg, role.name, self.displayData.ranks);
                }
                event.stopPropagation();
            },
            onMouseEnter: (event, role) => {
                if (!self.lockedRole) {
                    highlightRole(self.svg, role.name, self.displayData.ranks);
                }
            },
            onMouseLeave: () => {
                if (!self.lockedRole) {
                    resetHighlight(self.svg);
                }
            }
        };
        
        // Render role bubbles
        renderRoleBubbles(
            this.svg,
            roles,
            roleScale,
            this.roleColorScale,
            leftX,
            roleBubbleHandlers
        );
        
        // Render rank bubbles
        renderRankBubbles(
            this.svg,
            ranks,
            rankScale,
            this.roleColorScale,
            rightX
        );
    }
}

