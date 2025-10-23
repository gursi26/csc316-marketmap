class CompensationBubbles {
    constructor(parentElement, data) {
		this.parentElement = parentElement;
        this.data = data;
        this.initVis();
    }

	initVis() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.padding = 80;
        this.zoomedCompany = null;
        this.zoomedRole = null;
        
        this.svg = d3.select(this.parentElement)
            .attr("width", this.width)
            .attr("height", this.height);
        
        this.tooltip = d3.select("#tooltip");
    }

    updateVis(allCompaniesData) {
        this.svg.selectAll("*").remove();
        
        const pie = d3.pie().value(d => d.value);
        const colorScale = d3.scaleOrdinal()
            .domain(["Base Pay", "Stock", "Bonus"])
            .range(["#4CAF50", "#FFD700", "#DC143C"]);
        
        const roleOrbitRadius = 60;
        const maxRoleBubbleRadius = 12;
        const cellWidth = 2 * (roleOrbitRadius + maxRoleBubbleRadius) + 20;
        const cellHeight = 2 * (roleOrbitRadius + maxRoleBubbleRadius) + 20;
        
        const cols = Math.floor((this.width - 2 * this.padding) / cellWidth);
        const rows = Math.ceil(allCompaniesData.length / cols);
        
        const totalWidth = cols * cellWidth;
        const totalHeight = rows * cellHeight;
        
        this.svg.attr("width", totalWidth + 2 * this.padding)
                .attr("height", totalHeight + 2 * this.padding);
        
        allCompaniesData.forEach((companyData, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const centerX = this.padding + col * cellWidth + cellWidth / 2;
            const centerY = this.padding + row * cellHeight + cellHeight / 2;
            
            this.svg.append("circle")
                .attr("cx", centerX)
                .attr("cy", centerY)
                .attr("r", 40)
                .attr("fill", "steelblue")
                .style("cursor", "pointer")
                .on("click", () => this.zoomToCompany(companyData.ticker));
            
            this.svg.append("text")
                .attr("x", centerX)
                .attr("y", centerY + 5)
                .attr("text-anchor", "middle")
                .attr("fill", "white")
                .style("cursor", "pointer")
                .style("pointer-events", "none")
                .text(companyData.ticker);
            
            const radius = d3.scaleSqrt()
                .domain([0, d3.max(companyData.roles, d => d.avgPay)])
                .range([0, 12]);
            
            const angleStep = (2 * Math.PI) / companyData.roles.length;
            
            companyData.roles.forEach((role, i) => {
                const angle = -Math.PI / 2 + i * angleStep;
                const cx = centerX + Math.cos(angle) * 60;
                const cy = centerY + Math.sin(angle) * 60;
                const r = radius(role.avgPay);
                
                const pieData = [
                    { name: "Base Pay", value: role.avgBase },
                    { name: "Stock", value: role.avgStock },
                    { name: "Bonus", value: role.avgBonus }
                ];
                
                const arc = d3.arc()
                    .innerRadius(0)
                    .outerRadius(r);
                
                const g = this.svg.append("g")
                    .attr("transform", `translate(${cx}, ${cy})`)
                    .on("mouseenter", (event) => {
                        const basePct = (role.avgBase / role.avgPay * 100).toFixed(1);
                        const stockPct = (role.avgStock / role.avgPay * 100).toFixed(1);
                        const bonusPct = (role.avgBonus / role.avgPay * 100).toFixed(1);
                        
                        this.tooltip
                            .style("opacity", 1)
                            .style("background", "#e8f5e9")
                            .html(`<strong>${companyData.ticker} - ${role.name}</strong><br>
                                   Avg Pay: $${role.avgPay.toFixed(0)}<br>
                                   Base: ${basePct}%<br>
                                   Stock: ${stockPct}%<br>
                                   Bonus: ${bonusPct}%`);
                    })
                    .on("mousemove", (event) => {
                        this.tooltip
                            .style("left", (event.clientX + 10) + "px")
                            .style("top", (event.clientY + 10) + "px");
                    })
                    .on("mouseleave", () => {
                        this.tooltip.style("opacity", 0);
                    });
                
                g.selectAll("path")
                    .data(pie(pieData))
                    .enter()
                    .append("path")
                    .attr("d", arc)
                    .attr("fill", d => colorScale(d.data.name));
            });
        });
    }

	wrangleData() {
        const tickers = [...new Set(this.data.map(d => d.Ticker))].sort();
        
        this.allCompaniesData = tickers.map(ticker => {
            const companyData = this.data.filter(d => d.Ticker === ticker);
            const roleMap = d3.group(companyData, d => d["Role Name"]);
            
            const roles = Array.from(roleMap, ([roleName, rows]) => ({
                name: roleName,
                avgPay: d3.mean(rows, d => +d["Total Pay"]),
                avgBase: d3.mean(rows, d => +d["Base Pay"]),
                avgStock: d3.mean(rows, d => +d["Stock"]),
                avgBonus: d3.mean(rows, d => +d["Bonus"]),
                ranks: rows.map(row => ({
                    rankName: row["Role Rank Name"],
                    rank: +row["Role Rank"],
                    totalPay: +row["Total Pay"],
                    basePay: +row["Base Pay"],
                    stock: +row["Stock"],
                    bonus: +row["Bonus"]
                })).sort((a, b) => a.rank - b.rank)
            })).sort((a, b) => b.avgPay - a.avgPay);
            
            return {
                ticker: ticker,
                roles: roles
            };
        });
        
        this.updateVis(this.allCompaniesData);
    }

    zoomToCompany(ticker, fromX, fromY, fromRadius) {
        this.zoomedCompany = ticker;
        const companyData = this.allCompaniesData.find(c => c.ticker === ticker);
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        if (fromX !== undefined && fromY !== undefined) {
            const pie = d3.pie().value(d => d.value);
            
            const avgBase = d3.mean(companyData.roles, r => r.avgBase);
            const avgStock = d3.mean(companyData.roles, r => r.avgStock);
            const avgBonus = d3.mean(companyData.roles, r => r.avgBonus);
            
            const newPieData = [
                { name: "Base Pay", value: avgBase },
                { name: "Stock", value: avgStock },
                { name: "Bonus", value: avgBonus }
            ];
            
            const clickedGroup = this.svg.selectAll("g").filter(function() {
                const transform = d3.select(this).attr("transform");
                return transform && transform.includes(`translate(${fromX}, ${fromY})`);
            });
            
            this.svg.selectAll("*").filter(function() {
                const transform = d3.select(this).attr("transform");
                return !transform || !transform.includes(`translate(${fromX}, ${fromY})`);
            })
                .transition()
                .duration(ANIMATION_DURATION * 0.6)
                .style("opacity", 0)
                .remove();
            
            clickedGroup.selectAll("text").remove();
            clickedGroup.selectAll("g").remove();
            
            clickedGroup
                .transition()
                .duration(ANIMATION_DURATION)
                .attr("transform", `translate(${centerX}, ${centerY})`)
                .on("end", () => {
                    this.svg.selectAll("*").remove();
                    this.renderCompanyView(companyData);
                });
            
            const paths = clickedGroup.selectAll("path")
                .data(pie(newPieData), d => d.data.name);
            
            paths.transition()
                .duration(ANIMATION_DURATION)
                .attrTween("d", function(d) {
                    const interpolate = d3.interpolate(this._current || d, d);
                    this._current = interpolate(1);
                    return function(t) {
                        const interpolatedRadius = fromRadius + (COMPANY_FOCUS_CONSTANTS.centerBubbleRadius - fromRadius) * t;
                        const arc = d3.arc().innerRadius(0).outerRadius(interpolatedRadius);
                        return arc(interpolate(t));
                    };
                });
            
            return;
        }
        
        this.svg.selectAll("*").remove();
        this.renderCompanyView(companyData);
    }
    
    renderCompanyView(companyData) {
        this.svg.attr("width", this.width)
                .attr("height", this.height);
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const pie = d3.pie().value(d => d.value);
        const colorScale = d3.scaleOrdinal()
            .domain(["Base Pay", "Stock", "Bonus"])
            .range(["#4CAF50", "#FFD700", "#DC143C"]);
        
        const avgBase = d3.mean(companyData.roles, r => r.avgBase);
        const avgStock = d3.mean(companyData.roles, r => r.avgStock);
        const avgBonus = d3.mean(companyData.roles, r => r.avgBonus);
        
        const centerPieData = [
            { name: "Base Pay", value: avgBase },
            { name: "Stock", value: avgStock },
            { name: "Bonus", value: avgBonus }
        ];
        
        const centerArc = d3.arc()
            .innerRadius(0)
            .outerRadius(COMPANY_FOCUS_CONSTANTS.centerBubbleRadius);
        
        const centerGroup = this.svg.append("g")
            .attr("transform", `translate(${centerX}, ${centerY})`)
            .style("cursor", "pointer")
            .on("click", () => {
                this.zoomedCompany = null;
                this.updateVis(this.allCompaniesData);
            })
            .on("mouseenter", (event) => {
                const basePct = (avgBase / (avgBase + avgStock + avgBonus) * 100).toFixed(1);
                const stockPct = (avgStock / (avgBase + avgStock + avgBonus) * 100).toFixed(1);
                const bonusPct = (avgBonus / (avgBase + avgStock + avgBonus) * 100).toFixed(1);
                
                this.tooltip
                    .style("opacity", 1)
                    .style("background", "#f5f5f5")
                    .html(`<strong>${companyData.ticker} - Overall Average</strong><br>
                           Avg Base: $${avgBase.toFixed(0)} (${basePct}%)<br>
                           Avg Stock: $${avgStock.toFixed(0)} (${stockPct}%)<br>
                           Avg Bonus: $${avgBonus.toFixed(0)} (${bonusPct}%)`);
            })
            .on("mousemove", (event) => {
                this.tooltip
                    .style("left", (event.clientX + 10) + "px")
                    .style("top", (event.clientY + 10) + "px");
            })
            .on("mouseleave", () => {
                this.tooltip.style("opacity", 0);
            });
        
        centerGroup.selectAll("path")
            .data(pie(centerPieData), d => d.data.name)
            .join("path")
            .attr("d", centerArc)
            .attr("fill", d => colorScale(d.data.name))
            .each(function(d) { this._current = d; });
        
        this.svg.append("text")
            .attr("x", centerX)
            .attr("y", centerY + 5)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", `${COMPANY_FOCUS_CONSTANTS.centerTextSize}px`)
            .style("pointer-events", "none")
            .text(companyData.ticker);
        
        const legendX = this.width - 150;
        const legendY = 40;
        const legendData = [
            { label: "Base Pay", color: "#4CAF50" },
            { label: "Stock", color: "#FFD700" },
            { label: "Bonus", color: "#DC143C" }
        ];
        
        this.svg.append("rect")
            .attr("x", legendX - 15)
            .attr("y", legendY - 20)
            .attr("width", 140)
            .attr("height", 90)
            .attr("fill", "white")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("rx", 4);
        
        legendData.forEach((item, i) => {
            this.svg.append("circle")
                .attr("cx", legendX)
                .attr("cy", legendY + i * 25)
                .attr("r", 8)
                .attr("fill", item.color);
            
            this.svg.append("text")
                .attr("x", legendX + 20)
                .attr("y", legendY + i * 25 + 4)
                .attr("font-size", "14px")
                .attr("fill", "black")
                .text(item.label);
        });
        
        const radius = d3.scaleSqrt()
            .domain([0, d3.max(companyData.roles, d => d.avgPay)])
            .range([0, COMPANY_FOCUS_CONSTANTS.orbitBubbleMaxRadius]);
        
        const angleStep = (2 * Math.PI) / companyData.roles.length;
        
        companyData.roles.forEach((role, i) => {
            const angle = -Math.PI / 2 + i * angleStep;
            const cx = centerX + Math.cos(angle) * COMPANY_FOCUS_CONSTANTS.orbitRadius;
            const cy = centerY + Math.sin(angle) * COMPANY_FOCUS_CONSTANTS.orbitRadius;
            const r = radius(role.avgPay);
            
            const pieData = [
                { name: "Base Pay", value: role.avgBase },
                { name: "Stock", value: role.avgStock },
                { name: "Bonus", value: role.avgBonus }
            ];
            
            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(r);
            
            const g = this.svg.append("g")
                .attr("transform", `translate(${cx}, ${cy})`)
                .attr("class", `role-${i}`)
                .style("cursor", "pointer")
                .on("click", () => {
                    this.zoomToRole(role.name, cx, cy, r);
                })
                .on("mouseenter", (event) => {
                    const basePct = (role.avgBase / role.avgPay * 100).toFixed(1);
                    const stockPct = (role.avgStock / role.avgPay * 100).toFixed(1);
                    const bonusPct = (role.avgBonus / role.avgPay * 100).toFixed(1);
                    
                    this.tooltip
                        .style("opacity", 1)
                        .style("background", "#e8f5e9")
                        .html(`<strong>${companyData.ticker} - ${role.name}</strong><br>
                               Avg Pay: $${role.avgPay.toFixed(0)}<br>
                               Base: ${basePct}%<br>
                               Stock: ${stockPct}%<br>
                               Bonus: ${bonusPct}%`);
                })
                .on("mousemove", (event) => {
                    this.tooltip
                        .style("left", (event.clientX + 10) + "px")
                        .style("top", (event.clientY + 10) + "px");
                })
                .on("mouseleave", () => {
                    this.tooltip.style("opacity", 0);
                });
            
            g.selectAll("path")
                .data(pie(pieData), d => d.data.name)
                .join("path")
                .attr("d", arc)
                .attr("fill", d => colorScale(d.data.name))
                .each(function(d) { this._current = d; });
            
            const lines = role.name.split("-");
            const lineHeight = COMPANY_FOCUS_CONSTANTS.orbitBubbleTextLineHeight;
            const startY = cy - ((lines.length - 1) * lineHeight) / 2;
            
            const text = this.svg.append("text")
                .attr("x", cx)
                .attr("y", startY)
                .attr("text-anchor", "middle")
                .attr("font-size", `${COMPANY_FOCUS_CONSTANTS.orbitBubbleTextSize}px`)
                .attr("fill", "black")
                .style("pointer-events", "none");
            
            lines.forEach((line, idx) => {
                text.append("tspan")
                    .attr("x", cx)
                    .attr("dy", idx === 0 ? 0 : lineHeight)
                    .text(line);
            });
            
            const allRankPays = companyData.roles.flatMap(r => r.ranks.map(rank => rank.totalPay));
            const rankRadius = d3.scaleSqrt()
                .domain([0, d3.max(allRankPays)])
                .range([0, COMPANY_FOCUS_CONSTANTS.rankMaxRadius]);
            
            const rankOrbitRadius = r + COMPANY_FOCUS_CONSTANTS.rankOrbitOffset;
            const gapAngle = COMPANY_FOCUS_CONSTANTS.rankGapAngle;
            
            const rankSizes = role.ranks.map(rank => rankRadius(rank.totalPay));
            const angularWidths = rankSizes.map(rr => 2 * Math.asin(Math.min(1, rr / rankOrbitRadius)));
            const totalAngularWidth = angularWidths.reduce((sum, w) => sum + w, 0) + (role.ranks.length - 1) * gapAngle;
            
            let currentAngle = angle - totalAngularWidth / 2;
            
            role.ranks.forEach((rank, j) => {
                const rankR = rankSizes[j];
                const halfAngle = angularWidths[j] / 2;
                const rankAngle = currentAngle + halfAngle;
                
                const rankCx = cx + Math.cos(rankAngle) * rankOrbitRadius;
                const rankCy = cy + Math.sin(rankAngle) * rankOrbitRadius;
                
                currentAngle += angularWidths[j] + gapAngle;
                
                const rankPieData = [
                    { name: "Base Pay", value: rank.basePay },
                    { name: "Stock", value: rank.stock },
                    { name: "Bonus", value: rank.bonus }
                ];
                
                const rankArc = d3.arc()
                    .innerRadius(0)
                    .outerRadius(rankR);
                
                const rankG = this.svg.append("g")
                    .attr("transform", `translate(${rankCx}, ${rankCy})`)
                    .on("mouseenter", (event) => {
                        const basePct = (rank.basePay / rank.totalPay * 100).toFixed(1);
                        const stockPct = (rank.stock / rank.totalPay * 100).toFixed(1);
                        const bonusPct = (rank.bonus / rank.totalPay * 100).toFixed(1);
                        
                        this.tooltip
                            .style("opacity", 1)
                            .style("background", "#e3f2fd")
                            .html(`<strong>${companyData.ticker} - ${role.name}</strong><br>
                                   Rank: ${rank.rankName}<br>
                                   Total Pay: $${rank.totalPay.toFixed(0)}<br>
                                   Base: $${rank.basePay.toFixed(0)} (${basePct}%)<br>
                                   Stock: $${rank.stock.toFixed(0)} (${stockPct}%)<br>
                                   Bonus: $${rank.bonus.toFixed(0)} (${bonusPct}%)`);
                    })
                    .on("mousemove", (event) => {
                        this.tooltip
                            .style("left", (event.clientX + 10) + "px")
                            .style("top", (event.clientY + 10) + "px");
                    })
                    .on("mouseleave", () => {
                        this.tooltip.style("opacity", 0);
                    });
                
                rankG.selectAll("path")
                    .data(pie(rankPieData), d => d.data.name)
                    .join("path")
                    .attr("d", rankArc)
                    .attr("fill", d => colorScale(d.data.name))
                    .attr("stroke", "#333")
                    .attr("stroke-width", 0.5)
                    .each(function(d) { this._current = d; });
            });
        });
    }

    zoomToRole(roleName, fromX, fromY, fromRadius) {
        this.zoomedRole = roleName;
        this.zoomedCompany = null;
        
        const roleData = this.data.filter(d => d["Role Name"] === roleName);
        const companiesWithRole = d3.group(roleData, d => d.Ticker);
        
        const companyRoleData = Array.from(companiesWithRole, ([ticker, rows]) => ({
            ticker: ticker,
            avgPay: d3.mean(rows, d => +d["Total Pay"]),
            avgBase: d3.mean(rows, d => +d["Base Pay"]),
            avgStock: d3.mean(rows, d => +d["Stock"]),
            avgBonus: d3.mean(rows, d => +d["Bonus"]),
            ranks: rows.map(row => ({
                rankName: row["Role Rank Name"],
                rank: +row["Role Rank"],
                totalPay: +row["Total Pay"],
                basePay: +row["Base Pay"],
                stock: +row["Stock"],
                bonus: +row["Bonus"]
            })).sort((a, b) => a.rank - b.rank)
        }))
        .filter(c => c.avgPay > 0 && !isNaN(c.avgPay))
        .sort((a, b) => b.avgPay - a.avgPay)
        .slice(0, 10);
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        if (fromX !== undefined && fromY !== undefined) {
            const pie = d3.pie().value(d => d.value);
            
            const avgBase = d3.mean(companyRoleData, c => c.avgBase);
            const avgStock = d3.mean(companyRoleData, c => c.avgStock);
            const avgBonus = d3.mean(companyRoleData, c => c.avgBonus);
            
            const newPieData = [
                { name: "Base Pay", value: avgBase },
                { name: "Stock", value: avgStock },
                { name: "Bonus", value: avgBonus }
            ];
            
            const clickedGroup = this.svg.selectAll("g").filter(function() {
                const transform = d3.select(this).attr("transform");
                return transform && transform.includes(`translate(${fromX}, ${fromY})`);
            });
            
            this.svg.selectAll("*").filter(function() {
                const transform = d3.select(this).attr("transform");
                return !transform || !transform.includes(`translate(${fromX}, ${fromY})`);
            })
                .transition()
                .duration(ANIMATION_DURATION * 0.6)
                .style("opacity", 0)
                .remove();
            
            clickedGroup.selectAll("text").remove();
            clickedGroup.selectAll("g").remove();
            
            clickedGroup
                .transition()
                .duration(ANIMATION_DURATION)
                .attr("transform", `translate(${centerX}, ${centerY})`)
                .on("end", () => {
                    this.svg.selectAll("*").remove();
                    this.renderRoleView(roleName, companyRoleData);
                });
            
            const paths = clickedGroup.selectAll("path")
                .data(pie(newPieData), d => d.data.name);
            
            paths.transition()
                .duration(ANIMATION_DURATION)
                .attrTween("d", function(d) {
                    const interpolate = d3.interpolate(this._current || d, d);
                    this._current = interpolate(1);
                    return function(t) {
                        const interpolatedRadius = fromRadius + (ROLE_FOCUS_CONSTANTS.centerBubbleRadius - fromRadius) * t;
                        const arc = d3.arc().innerRadius(0).outerRadius(interpolatedRadius);
                        return arc(interpolate(t));
                    };
                });
            
            return;
        }
        
        this.svg.selectAll("*").remove();
        this.renderRoleView(roleName, companyRoleData);
    }
    
    renderRoleView(roleName, companyRoleData) {
        this.svg.attr("width", this.width)
                .attr("height", this.height);
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const pie = d3.pie().value(d => d.value);
        const colorScale = d3.scaleOrdinal()
            .domain(["Base Pay", "Stock", "Bonus"])
            .range(["#4CAF50", "#FFD700", "#DC143C"]);
        
        const avgBase = d3.mean(companyRoleData, c => c.avgBase);
        const avgStock = d3.mean(companyRoleData, c => c.avgStock);
        const avgBonus = d3.mean(companyRoleData, c => c.avgBonus);
        
        const centerPieData = [
            { name: "Base Pay", value: avgBase },
            { name: "Stock", value: avgStock },
            { name: "Bonus", value: avgBonus }
        ];
        
        const centerArc = d3.arc()
            .innerRadius(0)
            .outerRadius(ROLE_FOCUS_CONSTANTS.centerBubbleRadius);
        
        const centerGroup = this.svg.append("g")
            .attr("transform", `translate(${centerX}, ${centerY})`)
            .style("cursor", "pointer")
            .on("click", () => {
                this.zoomedRole = null;
                this.updateVis(this.allCompaniesData);
            })
            .on("mouseenter", (event) => {
                const basePct = (avgBase / (avgBase + avgStock + avgBonus) * 100).toFixed(1);
                const stockPct = (avgStock / (avgBase + avgStock + avgBonus) * 100).toFixed(1);
                const bonusPct = (avgBonus / (avgBase + avgStock + avgBonus) * 100).toFixed(1);
                
                this.tooltip
                    .style("opacity", 1)
                    .style("background", "#f5f5f5")
                    .html(`<strong>${roleName} - Overall Average</strong><br>
                           Avg Base: $${avgBase.toFixed(0)} (${basePct}%)<br>
                           Avg Stock: $${avgStock.toFixed(0)} (${stockPct}%)<br>
                           Avg Bonus: $${avgBonus.toFixed(0)} (${bonusPct}%)`);
            })
            .on("mousemove", (event) => {
                this.tooltip
                    .style("left", (event.clientX + 10) + "px")
                    .style("top", (event.clientY + 10) + "px");
            })
            .on("mouseleave", () => {
                this.tooltip.style("opacity", 0);
            });
        
        centerGroup.selectAll("path")
            .data(pie(centerPieData), d => d.data.name)
            .join("path")
            .attr("d", centerArc)
            .attr("fill", d => colorScale(d.data.name))
            .each(function(d) { this._current = d; });
        
        this.svg.append("text")
            .attr("x", centerX)
            .attr("y", centerY + 5)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", `${ROLE_FOCUS_CONSTANTS.centerTextSize}px`)
            .style("pointer-events", "none")
            .text(roleName);
        
        const legendX = this.width - 150;
        const legendY = 40;
        const legendData = [
            { label: "Base Pay", color: "#4CAF50" },
            { label: "Stock", color: "#FFD700" },
            { label: "Bonus", color: "#DC143C" }
        ];
        
        this.svg.append("rect")
            .attr("x", legendX - 15)
            .attr("y", legendY - 20)
            .attr("width", 140)
            .attr("height", 90)
            .attr("fill", "white")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("rx", 4);
        
        legendData.forEach((item, i) => {
            this.svg.append("circle")
                .attr("cx", legendX)
                .attr("cy", legendY + i * 25)
                .attr("r", 8)
                .attr("fill", item.color);
            
            this.svg.append("text")
                .attr("x", legendX + 20)
                .attr("y", legendY + i * 25 + 4)
                .attr("font-size", "14px")
                .attr("fill", "black")
                .text(item.label);
        });
        
        const radius = d3.scaleSqrt()
            .domain([0, d3.max(companyRoleData, d => d.avgPay)])
            .range([0, ROLE_FOCUS_CONSTANTS.orbitBubbleMaxRadius]);
        
        const angleStep = (2 * Math.PI) / companyRoleData.length;
        
        companyRoleData.forEach((company, i) => {
            const angle = -Math.PI / 2 + i * angleStep;
            const cx = centerX + Math.cos(angle) * ROLE_FOCUS_CONSTANTS.orbitRadius;
            const cy = centerY + Math.sin(angle) * ROLE_FOCUS_CONSTANTS.orbitRadius;
            const r = radius(company.avgPay);
            
            const pieData = [
                { name: "Base Pay", value: company.avgBase },
                { name: "Stock", value: company.avgStock },
                { name: "Bonus", value: company.avgBonus }
            ];
            
            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(r);
            
            const g = this.svg.append("g")
                .attr("transform", `translate(${cx}, ${cy})`)
                .attr("class", `company-${i}`)
                .style("cursor", "pointer")
                .on("click", () => {
                    this.zoomToCompany(company.ticker, cx, cy, r);
                })
                .on("mouseenter", (event) => {
                    const basePct = (company.avgBase / company.avgPay * 100).toFixed(1);
                    const stockPct = (company.avgStock / company.avgPay * 100).toFixed(1);
                    const bonusPct = (company.avgBonus / company.avgPay * 100).toFixed(1);
                    
                    this.tooltip
                        .style("opacity", 1)
                        .style("background", "#e8f5e9")
                        .html(`<strong>${company.ticker} - ${roleName}</strong><br>
                               Avg Pay: $${company.avgPay.toFixed(0)}<br>
                               Base: ${basePct}%<br>
                               Stock: ${stockPct}%<br>
                               Bonus: ${bonusPct}%`);
                })
                .on("mousemove", (event) => {
                    this.tooltip
                        .style("left", (event.clientX + 10) + "px")
                        .style("top", (event.clientY + 10) + "px");
                })
                .on("mouseleave", () => {
                    this.tooltip.style("opacity", 0);
                });
            
            g.selectAll("path")
                .data(pie(pieData), d => d.data.name)
                .join("path")
                .attr("d", arc)
                .attr("fill", d => colorScale(d.data.name))
                .each(function(d) { this._current = d; });
            
            this.svg.append("text")
                .attr("x", cx)
                .attr("y", cy)
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .attr("fill", "black")
                .style("pointer-events", "none")
                .text(company.ticker);
            
            const allRankPays = companyRoleData.flatMap(c => c.ranks.map(rank => rank.totalPay));
            const rankRadius = d3.scaleSqrt()
                .domain([0, d3.max(allRankPays)])
                .range([0, ROLE_FOCUS_CONSTANTS.rankMaxRadius]);
            
            const rankOrbitRadius = r + ROLE_FOCUS_CONSTANTS.rankOrbitOffset;
            const gapAngle = ROLE_FOCUS_CONSTANTS.rankGapAngle;
            
            const rankSizes = company.ranks.map(rank => rankRadius(rank.totalPay));
            const angularWidths = rankSizes.map(rr => 2 * Math.asin(Math.min(1, rr / rankOrbitRadius)));
            const totalAngularWidth = angularWidths.reduce((sum, w) => sum + w, 0) + (company.ranks.length - 1) * gapAngle;
            
            let currentAngle = angle - totalAngularWidth / 2;
            
            company.ranks.forEach((rank, j) => {
                const rankR = rankSizes[j];
                const halfAngle = angularWidths[j] / 2;
                const rankAngle = currentAngle + halfAngle;
                
                const rankCx = cx + Math.cos(rankAngle) * rankOrbitRadius;
                const rankCy = cy + Math.sin(rankAngle) * rankOrbitRadius;
                
                currentAngle += angularWidths[j] + gapAngle;
                
                const rankPieData = [
                    { name: "Base Pay", value: rank.basePay },
                    { name: "Stock", value: rank.stock },
                    { name: "Bonus", value: rank.bonus }
                ];
                
                const rankArc = d3.arc()
                    .innerRadius(0)
                    .outerRadius(rankR);
                
                const rankG = this.svg.append("g")
                    .attr("transform", `translate(${rankCx}, ${rankCy})`)
                    .on("mouseenter", (event) => {
                        const basePct = (rank.basePay / rank.totalPay * 100).toFixed(1);
                        const stockPct = (rank.stock / rank.totalPay * 100).toFixed(1);
                        const bonusPct = (rank.bonus / rank.totalPay * 100).toFixed(1);
                        
                        this.tooltip
                            .style("opacity", 1)
                            .style("background", "#e3f2fd")
                            .html(`<strong>${company.ticker} - ${roleName}</strong><br>
                                   Rank: ${rank.rankName}<br>
                                   Total Pay: $${rank.totalPay.toFixed(0)}<br>
                                   Base: $${rank.basePay.toFixed(0)} (${basePct}%)<br>
                                   Stock: $${rank.stock.toFixed(0)} (${stockPct}%)<br>
                                   Bonus: $${rank.bonus.toFixed(0)} (${bonusPct}%)`);
                    })
                    .on("mousemove", (event) => {
                        this.tooltip
                            .style("left", (event.clientX + 10) + "px")
                            .style("top", (event.clientY + 10) + "px");
                    })
                    .on("mouseleave", () => {
                        this.tooltip.style("opacity", 0);
                    });
                
                rankG.selectAll("path")
                    .data(pie(rankPieData), d => d.data.name)
                    .join("path")
                    .attr("d", rankArc)
                    .attr("fill", d => colorScale(d.data.name))
                    .attr("stroke", "#333")
                    .attr("stroke-width", 0.5)
                    .each(function(d) { this._current = d; });
            });
        });
    }
}
