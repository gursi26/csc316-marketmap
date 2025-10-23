class CompensationBubbles {
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
        
        this.tooltip = d3.select("#tooltip");
        
        // Setup company dropdown
        this.setupDropdown();
    }

    setupRoleColors() {
        // Get all unique roles across all data
        const allRoles = [...new Set(this.data.map(d => d["Role Name"]))].sort();
        
        // Create a color scale for all roles
        this.roleColorScale = d3.scaleOrdinal()
            .domain(allRoles)
            .range(d3.schemeTableau10.concat(d3.schemePaired));
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
        
        // Flatten all ranks and sort by total pay
        const allRanks = roles.flatMap(role => role.ranks)
            .filter(r => !isNaN(r.totalPay))
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
        const rightX = this.width - c.rightMargin;
        
        // Calculate available height for plotting
        const plotHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Create scales for vertical positioning
        const roleScale = d3.scaleLinear()
            .domain([0, d3.max(roles, d => d.avgPay)])
            .range([c.topMargin + plotHeight, c.topMargin]); // Inverted: higher pay = higher on screen
        
        const rankScale = d3.scaleLinear()
            .domain([0, d3.max(ranks, d => d.totalPay)])
            .range([c.topMargin + plotHeight, c.topMargin]); // Inverted: higher pay = higher on screen
        
        // Draw vertical lines
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
        
        // Add titles
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
        
        // Add company title at the top
        this.svg.append("text")
            .attr("x", this.width / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .attr("font-size", 24)
            .attr("font-weight", "bold")
            .text(company);
        
        // Create a map of role to its ranks for connecting lines
        const roleToRanks = new Map();
        roles.forEach(role => {
            roleToRanks.set(role.name, role.ranks);
        });
        
        // Draw connecting lines from roles to ranks
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
        
        // Draw role dots
        const roleDots = this.svg.selectAll(".role-dot")
            .data(roles)
            .join("circle")
            .attr("class", "role-dot")
            .attr("cx", leftX)
            .attr("cy", d => roleScale(d.avgPay))
            .attr("r", c.dotRadius)
            .attr("fill", d => this.roleColorScale(d.name))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("cursor", "pointer");
        
        // Add role labels
        this.svg.selectAll(".role-label")
            .data(roles)
            .join("text")
            .attr("class", "role-label")
            .attr("x", leftX - c.labelOffset)
            .attr("y", d => roleScale(d.avgPay) + 4)
            .attr("text-anchor", "end")
            .attr("font-size", c.fontSize)
            .text(d => d.name)
            .style("pointer-events", "none");
        
        // Draw rank dots
        const rankDots = this.svg.selectAll(".rank-dot")
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
        
        // Add rank labels (hidden by default, will be shown when role is selected)
        this.svg.selectAll(".rank-label")
            .data(ranks)
            .join("text")
            .attr("class", "rank-label")
            .attr("x", rightX + c.labelOffset)
            .attr("y", d => rankScale(d.totalPay) + 4)
            .attr("text-anchor", "start")
            .attr("font-size", c.fontSize)
            .text(d => `${d.roleName} - ${d.rankName}`)
            .style("pointer-events", "none")
            .style("opacity", 0); // Hidden by default
        
        // Add tooltips and highlighting for role dots
        roleDots
            .on("click", (event, d) => {
                // Toggle lock on this role
                if (this.lockedRole === d.name) {
                    this.lockedRole = null;
                    this.resetHighlight();
                } else {
                    this.lockedRole = d.name;
                    this.highlightRole(d.name);
                }
                event.stopPropagation();
            })
            .on("mouseenter", (event, d) => {
                // Only highlight on hover if nothing is locked
                if (!this.lockedRole) {
                    this.highlightRole(d.name);
                }
                
                const basePct = (d.avgBase / d.avgPay * 100).toFixed(1);
                const stockPct = (d.avgStock / d.avgPay * 100).toFixed(1);
                const bonusPct = (d.avgBonus / d.avgPay * 100).toFixed(1);
                
                this.tooltip
                    .style("opacity", 1)
                    .style("background", "#e8f5e9")
                    .html(`<strong>${company} - ${d.name}</strong><br>
                           Avg Pay: $${d.avgPay.toFixed(0)}<br>
                           Base: $${d.avgBase.toFixed(0)} (${basePct}%)<br>
                           Stock: $${d.avgStock.toFixed(0)} (${stockPct}%)<br>
                           Bonus: $${d.avgBonus.toFixed(0)} (${bonusPct}%)<br>
                           <em style="color: #666; font-size: 11px;">Click to lock/unlock</em>`);
            })
            .on("mousemove", (event) => {
                this.tooltip
                    .style("left", (event.clientX + 10) + "px")
                    .style("top", (event.clientY + 10) + "px");
            })
            .on("mouseleave", () => {
                // Only reset if nothing is locked
                if (!this.lockedRole) {
                    this.resetHighlight();
                }
                this.tooltip.style("opacity", 0);
            });
        
        // Add tooltips for rank dots
        rankDots
            .on("mouseenter", (event, d) => {
                // Only show tooltip if no role is locked, or if this rank belongs to the locked role
                if (!this.lockedRole || d.roleName === this.lockedRole) {
                    const basePct = (d.basePay / d.totalPay * 100).toFixed(1);
                    const stockPct = (d.stock / d.totalPay * 100).toFixed(1);
                    const bonusPct = (d.bonus / d.totalPay * 100).toFixed(1);
                    
                    this.tooltip
                        .style("opacity", 1)
                        .style("background", "#e3f2fd")
                        .html(`<strong>${company} - ${d.roleName}</strong><br>
                               Rank: ${d.rankName}<br>
                               Total Pay: $${d.totalPay.toFixed(0)}<br>
                               Base: $${d.basePay.toFixed(0)} (${basePct}%)<br>
                               Stock: $${d.stock.toFixed(0)} (${stockPct}%)<br>
                               Bonus: $${d.bonus.toFixed(0)} (${bonusPct}%)`);
                }
            })
            .on("mousemove", (event, d) => {
                // Only move tooltip if it's visible
                if (!this.lockedRole || d.roleName === this.lockedRole) {
                    this.tooltip
                        .style("left", (event.clientX + 10) + "px")
                        .style("top", (event.clientY + 10) + "px");
                }
            })
            .on("mouseleave", () => {
                this.tooltip.style("opacity", 0);
            });
        
        // Add click handler to SVG background to unlock
        this.svg.on("click", () => {
            if (this.lockedRole) {
                this.lockedRole = null;
                this.resetHighlight();
            }
        });
    }

    highlightRole(roleName) {
        // Get the indices of ranks that belong to this role
        const { ranks } = this.displayData;
        const roleRankIndices = new Set();
        
        ranks.forEach((rank, idx) => {
            if (rank.roleName === roleName) {
                roleRankIndices.add(idx);
            }
        });
        
        // Grey out all role dots except the hovered one
        this.svg.selectAll(".role-dot")
            .transition()
            .duration(200)
            .style("opacity", d => d.name === roleName ? 1 : 0.2);
        
        // Grey out all role labels except the hovered one
        this.svg.selectAll(".role-label")
            .transition()
            .duration(200)
            .style("opacity", d => d.name === roleName ? 1 : 0.2);
        
        // Hide all rank dots except those belonging to this role
        this.svg.selectAll(".rank-dot")
            .transition()
            .duration(200)
            .style("opacity", (d, i) => roleRankIndices.has(i) ? 1 : 0);
        
        // Show rank labels only for this role
        this.svg.selectAll(".rank-label")
            .transition()
            .duration(200)
            .style("opacity", (d, i) => roleRankIndices.has(i) ? 1 : 0);
        
        // Highlight connection lines for this role
        this.svg.selectAll(".connection-line")
            .transition()
            .duration(200)
            .attr("stroke-opacity", function() {
                const lineRole = d3.select(this).attr("data-role");
                return lineRole === roleName ? 0.8 : 0.05;
            })
            .attr("stroke-width", function() {
                const lineRole = d3.select(this).attr("data-role");
                return lineRole === roleName ? 2.5 : SLOPE_CHART_CONSTANTS.lineWidth;
            });
    }

    resetHighlight() {
        const c = SLOPE_CHART_CONSTANTS;
        
        // Reset all role dots
        this.svg.selectAll(".role-dot")
            .transition()
            .duration(200)
            .style("opacity", 1);
        
        // Reset all role labels
        this.svg.selectAll(".role-label")
            .transition()
            .duration(200)
            .style("opacity", 1);
        
        // Reset all rank dots
        this.svg.selectAll(".rank-dot")
            .transition()
            .duration(200)
            .style("opacity", 1);
        
        // Hide all rank labels (they're hidden by default in unselected view)
        this.svg.selectAll(".rank-label")
            .transition()
            .duration(200)
            .style("opacity", 0);
        
        // Reset all connection lines
        this.svg.selectAll(".connection-line")
            .transition()
            .duration(200)
            .attr("stroke-opacity", c.lineOpacity)
            .attr("stroke-width", c.lineWidth);
    }
}
