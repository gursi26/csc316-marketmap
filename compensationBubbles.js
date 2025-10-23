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
            .range(["#4CAF50", "#FFC107", "#FF5722"]);
        
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
                    .attr("transform", `translate(${cx}, ${cy})`);
                
                g.selectAll("path")
                    .data(pie(pieData))
                    .enter()
                    .append("path")
                    .attr("d", arc)
                    .attr("fill", d => colorScale(d.data.name))
                    .on("mouseover", (event) => {
                        const basePct = (role.avgBase / role.avgPay * 100).toFixed(1);
                        const stockPct = (role.avgStock / role.avgPay * 100).toFixed(1);
                        const bonusPct = (role.avgBonus / role.avgPay * 100).toFixed(1);
                        
                        this.tooltip
                            .style("opacity", 1)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY + 10) + "px")
                            .html(`<strong>${companyData.ticker} - ${role.name}</strong><br>
                                   Avg Pay: $${role.avgPay.toFixed(0)}<br>
                                   Base: ${basePct}%<br>
                                   Stock: ${stockPct}%<br>
                                   Bonus: ${bonusPct}%`);
                    })
                    .on("mouseout", () => {
                        this.tooltip.style("opacity", 0);
                    });
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

    zoomToCompany(ticker) {
        this.zoomedCompany = ticker;
        const companyData = this.allCompaniesData.find(c => c.ticker === ticker);
        
        this.svg.selectAll("*").remove();
        
        this.svg.attr("width", this.width)
                .attr("height", this.height);
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const pie = d3.pie().value(d => d.value);
        const colorScale = d3.scaleOrdinal()
            .domain(["Base Pay", "Stock", "Bonus"])
            .range(["#4CAF50", "#FFC107", "#FF5722"]);
        
        this.svg.append("circle")
            .attr("cx", centerX)
            .attr("cy", centerY)
            .attr("r", 150)
            .attr("fill", "steelblue")
            .style("cursor", "pointer")
            .on("click", () => {
                this.zoomedCompany = null;
                this.updateVis(this.allCompaniesData);
            });
        
        this.svg.append("text")
            .attr("x", centerX)
            .attr("y", centerY + 5)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "20px")
            .style("pointer-events", "none")
            .text(companyData.ticker);
        
        const radius = d3.scaleSqrt()
            .domain([0, d3.max(companyData.roles, d => d.avgPay)])
            .range([0, 60]);
        
        const angleStep = (2 * Math.PI) / companyData.roles.length;
        
        companyData.roles.forEach((role, i) => {
            const angle = -Math.PI / 2 + i * angleStep;
            const cx = centerX + Math.cos(angle) * 300;
            const cy = centerY + Math.sin(angle) * 300;
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
                .attr("transform", `translate(${cx}, ${cy})`);
            
            g.selectAll("path")
                .data(pie(pieData))
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", d => colorScale(d.data.name))
                .on("mouseover", (event) => {
                    const basePct = (role.avgBase / role.avgPay * 100).toFixed(1);
                    const stockPct = (role.avgStock / role.avgPay * 100).toFixed(1);
                    const bonusPct = (role.avgBonus / role.avgPay * 100).toFixed(1);
                    
                    this.tooltip
                        .style("opacity", 1)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY + 10) + "px")
                        .html(`<strong>${companyData.ticker} - ${role.name}</strong><br>
                               Avg Pay: $${role.avgPay.toFixed(0)}<br>
                               Base: ${basePct}%<br>
                               Stock: ${stockPct}%<br>
                               Bonus: ${bonusPct}%`);
                })
                .on("mouseout", () => {
                    this.tooltip.style("opacity", 0);
                });
            
            const lines = role.name.split("-");
            const lineHeight = 14;
            const startY = cy - ((lines.length - 1) * lineHeight) / 2;
            
            const text = this.svg.append("text")
                .attr("x", cx)
                .attr("y", startY)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("fill", "black");
            
            lines.forEach((line, idx) => {
                text.append("tspan")
                    .attr("x", cx)
                    .attr("dy", idx === 0 ? 0 : lineHeight)
                    .text(line);
            });
            
            const allRankPays = companyData.roles.flatMap(r => r.ranks.map(rank => rank.totalPay));
            const rankRadius = d3.scaleSqrt()
                .domain([0, d3.max(allRankPays)])
                .range([0, 12]);
            
            const rankOrbitRadius = r + 18;
            const arcSpan = Math.PI / 2.2;
            const rankAngleStep = role.ranks.length > 1 ? arcSpan / (role.ranks.length - 1) : 0;
            const startAngle = angle - arcSpan / 2;
            
            role.ranks.forEach((rank, j) => {
                const rankR = rankRadius(rank.totalPay);
                const rankAngle = startAngle + j * rankAngleStep;
                
                const rankCx = cx + Math.cos(rankAngle) * rankOrbitRadius;
                const rankCy = cy + Math.sin(rankAngle) * rankOrbitRadius;
                
                this.svg.append("circle")
                    .attr("cx", rankCx)
                    .attr("cy", rankCy)
                    .attr("r", rankR)
                    .attr("fill", "#2196F3")
                    .attr("stroke", "#1565C0")
                    .attr("stroke-width", 0.5)
                    .on("mouseover", (event) => {
                        this.tooltip
                            .style("opacity", 1)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY + 10) + "px")
                            .html(`<strong>${companyData.ticker} - ${role.name}</strong><br>
                                   Rank: ${rank.rankName}<br>
                                   Total Pay: $${rank.totalPay.toFixed(0)}<br>
                                   Base: $${rank.basePay.toFixed(0)}<br>
                                   Stock: $${rank.stock.toFixed(0)}<br>
                                   Bonus: $${rank.bonus.toFixed(0)}`);
                    })
                    .on("mouseout", () => {
                        this.tooltip.style("opacity", 0);
                    });
            });
        });
    }
}
