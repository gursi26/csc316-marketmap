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

    formatRoleName(roleName) {
        // Convert "software-engineer" to "Software Engineer"
        return roleName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    kernelDensityEstimator(kernel, thresholds) {
        return function(values) {
            return thresholds.map(t => [t, d3.sum(values, v => kernel(t - v))]);
        };
    }

    kernelGaussian(bandwidth) {
        return function(v) {
            const z = v / bandwidth;
            return (1 / (bandwidth * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
        };
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
        // Position rank line closer to the left
        const rightX = this.width * 0.65;
        
        // Calculate available height for plotting
        const plotHeight = this.height - c.topMargin - c.bottomMargin;
        
        // Create a unified scale for both roles and ranks
        const maxRolePay = d3.max(roles, d => d.avgPay);
        const maxRankPay = d3.max(ranks, d => d.totalPay);
        const maxPay = Math.max(maxRolePay, maxRankPay);
        
        const payScale = d3.scaleLinear()
            .domain([0, maxPay])
            .range([c.topMargin + plotHeight, c.topMargin]); // Inverted: higher pay = higher on screen
        
        // Use the same scale for both roles and ranks
        const roleScale = payScale;
        const rankScale = payScale;
        
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
        
        // Create and draw axis with ticks
        const yAxis = d3.axisLeft(payScale)
            .ticks(10)
            .tickFormat(d => {
                if (d >= 1000000) {
                    return `$${(d / 1000000).toFixed(1)}M`;
                } else {
                    return `$${(d / 1000).toFixed(0)}k`;
                }
            });
        
        // Draw axis in the middle between the two lines
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
        
        // Reusable collision detection function (bottom-justified)
        const resolveBottomJustifiedCollisions = (bubbleData, bubbleHeight, minSpacing) => {
            // Sort by dotY position from bottom to top (higher Y values = lower on screen, so descending)
            const sorted = [...bubbleData].sort((a, b) => b.dotY - a.dotY);
            
            // Resolve collisions by pushing bubbles up
            for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i];
                const next = sorted[i + 1];
                
                const currentTop = current.bubbleY - bubbleHeight / 2;
                const nextBottom = next.bubbleY + bubbleHeight / 2;
                
                if (nextBottom + minSpacing > currentTop) {
                    // Collision detected, push next bubble up
                    next.bubbleY = currentTop - minSpacing - bubbleHeight / 2;
                }
            }
            
            return sorted;
        };
        
        // Create role label bubbles with collision detection
        const bubbleHeight = 15;
        const bubblePadding = 5;
        const bubbleMinSpacing = 2; // Minimum spacing between bubbles
        const bubbleRightEdge = leftX - 20; // Right edge of bubbles (right-justified)
        
        // Prepare bubble data with initial positions
        const roleBubbleData = roles.map((role) => {
            const text = this.formatRoleName(role.name);
            const textWidth = text.length * 5;
            const bubbleWidth = textWidth + bubblePadding * 2;
            
            return {
                role: role,
                text: text,
                width: bubbleWidth,
                dotY: roleScale(role.avgPay),
                bubbleY: roleScale(role.avgPay), // Initial position
                height: bubbleHeight
            };
        });
        
        // Resolve collisions
        const resolvedRoleBubbles = resolveBottomJustifiedCollisions(roleBubbleData, bubbleHeight, bubbleMinSpacing);
        
        // Draw bubbles
        resolvedRoleBubbles.forEach((item) => {
            const role = item.role;
            const bubbleY = item.bubbleY;
            const dotY = item.dotY;
            const bubbleWidth = item.width;
            const bubbleX = bubbleRightEdge - bubbleWidth; // Right-justified
            
            // Draw bubble
            const bubbleGroup = this.svg.append("g")
                .attr("class", "role-label-bubble")
                .attr("data-role", role.name)
                .style("cursor", "pointer");
            
            bubbleGroup.append("rect")
                .attr("x", bubbleX)
                .attr("y", bubbleY - bubbleHeight / 2)
                .attr("width", bubbleWidth)
                .attr("height", bubbleHeight)
                .attr("rx", 8)
                .attr("fill", "white")
                .attr("stroke", this.roleColorScale(role.name))
                .attr("stroke-width", 1.5);
            
            bubbleGroup.append("text")
                .attr("x", bubbleX + bubbleWidth / 2)
                .attr("y", bubbleY + 3)
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .attr("fill", "#333")
                .text(item.text)
                .style("pointer-events", "none"); // Make text transparent to mouse events
            
            // Add click and hover handlers to bubble
            bubbleGroup
                .on("click", (event) => {
                    // Toggle lock on this role
                    if (this.lockedRole === role.name) {
                        this.lockedRole = null;
                        this.resetHighlight();
                    } else {
                        this.lockedRole = role.name;
                        this.highlightRole(role.name);
                    }
                    event.stopPropagation();
                })
                .on("mouseenter", (event) => {
                    // Only highlight on hover if nothing is locked
                    if (!this.lockedRole) {
                        this.highlightRole(role.name);
                    }
                    
                    const basePct = (role.avgBase / role.avgPay * 100).toFixed(1);
                    const stockPct = (role.avgStock / role.avgPay * 100).toFixed(1);
                    const bonusPct = (role.avgBonus / role.avgPay * 100).toFixed(1);
                    
                    this.tooltip
                        .style("opacity", 1)
                        .style("background", "#e8f5e9")
                        .html(`<strong>${this.displayData.company} - ${this.formatRoleName(role.name)}</strong><br>
                               Avg Pay: $${role.avgPay.toFixed(0)}<br>
                               Base: $${role.avgBase.toFixed(0)} (${basePct}%)<br>
                               Stock: $${role.avgStock.toFixed(0)} (${stockPct}%)<br>
                               Bonus: $${role.avgBonus.toFixed(0)} (${bonusPct}%)<br>
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
            
            // Draw curved arrow from bubble to dot
            const arrowStart = bubbleRightEdge; // From right edge
            const arrowEnd = leftX;
            const controlX = (arrowStart + arrowEnd) / 2;
            
            this.svg.append("path")
                .attr("class", "role-connector")
                .attr("data-role", role.name)
                .attr("d", `M ${arrowStart} ${bubbleY} Q ${controlX} ${(bubbleY + dotY) / 2}, ${arrowEnd} ${dotY}`)
                .attr("stroke", this.roleColorScale(role.name))
                .attr("stroke-width", 1.5)
                .attr("fill", "none")
                .attr("opacity", 0.4);
        });
        
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
        
        // Create rank label bubbles (hidden by default)
        // NO collision detection here - that happens per-role when highlighting
        const rankBubbleLeftEdge = rightX + 20; // Left edge of rank bubbles
        
        // Draw rank bubbles at their exact dot positions
        ranks.forEach((rank, idx) => {
            const text = `${this.formatRoleName(rank.roleName)} - ${rank.rankName}`;
            const textWidth = text.length * 5;
            const bubbleWidth = textWidth + bubblePadding * 2;
            const dotY = rankScale(rank.totalPay);
            const bubbleY = dotY; // Start at dot position
            const rankBubbleX = rankBubbleLeftEdge; // Left-aligned for rank bubbles
            
            // Draw bubble
            const bubbleGroup = this.svg.append("g")
                .attr("class", "rank-label-bubble")
                .attr("data-rank-index", idx)
                .attr("data-role-name", rank.roleName) // Store role name for filtering
                .style("opacity", 0)
                .style("cursor", "pointer");
            
            bubbleGroup.append("rect")
                .attr("x", rankBubbleX)
                .attr("y", bubbleY - bubbleHeight / 2)
                .attr("width", bubbleWidth)
                .attr("height", bubbleHeight)
                .attr("rx", 8)
                .attr("fill", "white")
                .attr("stroke", this.roleColorScale(rank.roleName))
                .attr("stroke-width", 1.5);
            
            bubbleGroup.append("text")
                .attr("x", rankBubbleX + bubbleWidth / 2)
                .attr("y", bubbleY + 3)
                .attr("text-anchor", "middle")
                .attr("font-size", 10)
                .attr("fill", "#333")
                .text(text)
                .style("pointer-events", "none"); // Make text transparent to mouse events
            
            // Add hover handler to rank bubble
            bubbleGroup
                    .on("mouseenter", (event) => {
                        // Only show tooltip if no role is locked, or if this rank belongs to the locked role
                        if (!this.lockedRole || rank.roleName === this.lockedRole) {
                            const basePct = (rank.basePay / rank.totalPay * 100).toFixed(1);
                            const stockPct = (rank.stock / rank.totalPay * 100).toFixed(1);
                            const bonusPct = (rank.bonus / rank.totalPay * 100).toFixed(1);
                            
                            this.tooltip
                                .style("opacity", 1)
                                .style("background", "#e3f2fd")
                            .html(`<strong>${this.displayData.company} - ${this.formatRoleName(rank.roleName)}</strong><br>
                                       Rank: ${rank.rankName}<br>
                                       Total Pay: $${rank.totalPay.toFixed(0)}<br>
                                       Base: $${rank.basePay.toFixed(0)} (${basePct}%)<br>
                                       Stock: $${rank.stock.toFixed(0)} (${stockPct}%)<br>
                                       Bonus: $${rank.bonus.toFixed(0)} (${bonusPct}%)`);
                        }
                    })
                    .on("mousemove", (event) => {
                        // Only move tooltip if it's visible
                        if (!this.lockedRole || rank.roleName === this.lockedRole) {
                            this.tooltip
                                .style("left", (event.clientX + 10) + "px")
                                .style("top", (event.clientY + 10) + "px");
                        }
                    })
                    .on("mouseleave", () => {
                        this.tooltip.style("opacity", 0);
                    });
                
            // Draw curved arrow from dot to bubble
            const arrowStart = rightX;
            const arrowEnd = rankBubbleX;
            const controlX = (arrowStart + arrowEnd) / 2;
            
            this.svg.append("path")
                .attr("class", "rank-connector")
                .attr("data-rank-index", idx)
                .attr("data-role-name", rank.roleName) // Store role name for filtering
                .attr("d", `M ${arrowStart} ${dotY} Q ${controlX} ${(dotY + bubbleY) / 2}, ${arrowEnd} ${bubbleY}`)
                .attr("stroke", this.roleColorScale(rank.roleName))
                .attr("stroke-width", 1.5)
                .attr("fill", "none")
                .attr("opacity", 0)
                .style("opacity", 0);
        });
        
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
                    .html(`<strong>${company} - ${this.formatRoleName(d.name)}</strong><br>
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
                        .html(`<strong>${company} - ${this.formatRoleName(d.roleName)}</strong><br>
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
        
        // Apply collision detection ONLY to rank bubbles for this role
        const bubbleHeight = 15;
        const bubbleMinSpacing = 2;
        const visibleRankBubbles = [];
        
        // Collect only the bubbles for this role
        this.svg.selectAll(".rank-label-bubble").each(function() {
            const bubble = d3.select(this);
            const rankRoleName = bubble.attr("data-role-name");
            const rankIndex = parseInt(bubble.attr("data-rank-index"));
            
            if (rankRoleName === roleName) {
                const rect = bubble.select("rect");
                const currentY = parseFloat(rect.attr("y")) + bubbleHeight / 2; // Center Y
                visibleRankBubbles.push({
                    element: this,
                    rankIndex: rankIndex,
                    dotY: currentY,
                    bubbleY: currentY
                });
            }
        });
        
        // Sort by position and resolve collisions
        visibleRankBubbles.sort((a, b) => b.dotY - a.dotY);
        for (let i = 0; i < visibleRankBubbles.length - 1; i++) {
            const current = visibleRankBubbles[i];
            const next = visibleRankBubbles[i + 1];
            
            const currentTop = current.bubbleY - bubbleHeight / 2;
            const nextBottom = next.bubbleY + bubbleHeight / 2;
            
            if (nextBottom + bubbleMinSpacing > currentTop) {
                next.bubbleY = currentTop - bubbleMinSpacing - bubbleHeight / 2;
            }
        }
        
        // Apply transforms to visible rank bubbles
        visibleRankBubbles.forEach(item => {
            const bubble = d3.select(item.element);
            const offset = item.bubbleY - item.dotY;
            
            bubble.attr("transform", `translate(0, ${offset})`);
            
            // Update the connector arrow
            const connector = this.svg.select(`.rank-connector[data-rank-index="${item.rankIndex}"]`);
            if (!connector.empty()) {
                const path = connector.attr("d");
                const match = path.match(/M ([\d.]+) ([\d.]+)/);
                if (match) {
                    const arrowStart = parseFloat(match[1]);
                    const dotY = parseFloat(match[2]);
                    const arrowEnd = arrowStart + 20;
                    const controlX = (arrowStart + arrowEnd) / 2;
                    
                    connector.attr("d", `M ${arrowStart} ${dotY} Q ${controlX} ${(dotY + item.bubbleY) / 2}, ${arrowEnd} ${item.bubbleY}`);
                }
            }
        });
        
        // Grey out all role dots except the hovered one
        this.svg.selectAll(".role-dot")
            .transition()
            .duration(200)
            .style("opacity", d => d.name === roleName ? 1 : 0.2);
        
        // Grey out all role label bubbles except the hovered one
        this.svg.selectAll(".role-label-bubble")
            .transition()
            .duration(200)
            .style("opacity", function() {
                const bubbleRole = d3.select(this).attr("data-role");
                return bubbleRole === roleName ? 1 : 0.2;
            });
        
        // Grey out role connectors
        this.svg.selectAll(".role-connector")
            .transition()
            .duration(200)
            .style("opacity", function() {
                const connectorRole = d3.select(this).attr("data-role");
                return connectorRole === roleName ? 0.6 : 0.1;
            });
        
        // Hide all rank dots except those belonging to this role
        this.svg.selectAll(".rank-dot")
            .transition()
            .duration(200)
            .style("opacity", (d, i) => roleRankIndices.has(i) ? 1 : 0);
        
        // Show rank label bubbles only for this role
        this.svg.selectAll(".rank-label-bubble")
            .transition()
            .duration(200)
            .style("opacity", function() {
                const rankIndex = parseInt(d3.select(this).attr("data-rank-index"));
                return roleRankIndices.has(rankIndex) ? 1 : 0;
            });
        
        // Show rank connectors only for this role
        this.svg.selectAll(".rank-connector")
            .transition()
            .duration(200)
            .style("opacity", function() {
                const rankIndex = parseInt(d3.select(this).attr("data-rank-index"));
                return roleRankIndices.has(rankIndex) ? 0.6 : 0;
            });
        
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
        
        // Reset all role label bubbles
        this.svg.selectAll(".role-label-bubble")
            .transition()
            .duration(200)
            .style("opacity", 1);
        
        // Reset role connectors
        this.svg.selectAll(".role-connector")
            .transition()
            .duration(200)
            .style("opacity", 0.4);
        
        // Reset all rank dots
        this.svg.selectAll(".rank-dot")
            .transition()
            .duration(200)
            .style("opacity", 1);
        
        // Hide all rank label bubbles and reset transforms
        this.svg.selectAll(".rank-label-bubble")
            .transition()
            .duration(200)
            .style("opacity", 0)
            .attr("transform", "translate(0, 0)");
        
        // Hide rank connectors and reset paths
        this.svg.selectAll(".rank-connector").each(function() {
            const connector = d3.select(this);
            const path = connector.attr("d");
            const match = path.match(/M ([\d.]+) ([\d.]+)/);
            if (match) {
                const arrowStart = parseFloat(match[1]);
                const dotY = parseFloat(match[2]);
                const arrowEnd = arrowStart + 20;
                const controlX = (arrowStart + arrowEnd) / 2;
                
                connector.transition()
                    .duration(200)
                    .style("opacity", 0)
                    .attr("d", `M ${arrowStart} ${dotY} Q ${controlX} ${dotY}, ${arrowEnd} ${dotY}`);
            } else {
                connector.transition()
                    .duration(200)
                    .style("opacity", 0);
            }
        });
        
        // Reset all connection lines
        this.svg.selectAll(".connection-line")
            .transition()
            .duration(200)
            .attr("stroke-opacity", c.lineOpacity)
            .attr("stroke-width", c.lineWidth);
    }
}
