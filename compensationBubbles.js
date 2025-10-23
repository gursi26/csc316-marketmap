class CompensationBubbles {
    constructor(parentElement, data) {
		this.parentElement = parentElement;
        this.data = data;
        this.initVis();
    }

	initVis() {
        const vis = this;

        vis.width = window.innerWidth;
        vis.height = window.innerHeight;
        vis.radius = Math.min(vis.width, vis.height) * 0.38;

        vis.svg = d3.select(vis.parentElement)
            .attr("width", vis.width)
            .attr("height", vis.height);

        vis.g = vis.svg.append("g")
            .attr("transform", `translate(${vis.width / 2}, ${vis.height / 2})`);

        vis.color = d3.scaleOrdinal(d3.schemeCategory10);

        vis.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(vis.radius / 2)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1 - 1);

        vis.mousearc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1);

        vis.label = vis.g.append("text")
            .attr("text-anchor", "middle")
            .attr("fill", "#e0e0e0")
            .style("visibility", "hidden");

        vis.label.append("tspan")
            .attr("class", "company-name")
            .attr("x", 0)
            .attr("y", -70)
            .attr("font-size", "1.4em")
            .attr("font-weight", "bold")
            .text("");

        vis.label.append("tspan")
            .attr("class", "role-name")
            .attr("x", 0)
            .attr("y", -40)
            .attr("font-size", "1.1em")
            .text("");

        vis.label.append("tspan")
            .attr("class", "rank-name")
            .attr("x", 0)
            .attr("y", -15)
            .attr("font-size", "0.9em")
            .attr("fill", "#999")
            .text("");

        vis.label.append("tspan")
            .attr("class", "pay-amount")
            .attr("x", 0)
            .attr("y", 8)
            .attr("font-size", "1.2em")
            .attr("font-weight", "bold")
            .attr("fill", "#e0e0e0")
            .text("");
        
        vis.label.append("tspan")
            .attr("class", "base-info")
            .attr("x", 0)
            .attr("y", 30)
            .attr("font-size", "0.75em")
            .attr("fill", "#4CAF50")
            .text("");
        
        vis.label.append("tspan")
            .attr("class", "stock-info")
            .attr("x", 0)
            .attr("y", 44)
            .attr("font-size", "0.75em")
            .attr("fill", "#FFD700")
            .text("");
        
        vis.label.append("tspan")
            .attr("class", "bonus-info")
            .attr("x", 0)
            .attr("y", 58)
            .attr("font-size", "0.75em")
            .attr("fill", "#DC143C")
            .text("");

        vis.wrangleData();
    }

    wrangleData() {
        const vis = this;

        d3.csv("dataset/cleaned/Company-info.csv").then(companyInfo => {
            vis.companyInfoMap = new Map(companyInfo.map(d => [d.Ticker, d.Name]));
            
            const tickers = [...new Set(vis.data.map(d => d.Ticker))].sort();
            vis.currentTicker = tickers[0];

            vis.allCompaniesData = tickers.map(ticker => {
                const companyRows = vis.data.filter(d => d.Ticker === ticker);
                
                const roleGroups = d3.group(companyRows, d => d["Role Name"]);
                const roles = Array.from(roleGroups, ([roleName, rows]) => {
                    const avgPay = d3.mean(rows, d => +d["Total Pay"]);
                    const avgBase = d3.mean(rows, d => +d["Base Pay"]);
                    const avgStock = d3.mean(rows, d => +d["Stock"]);
                    const avgBonus = d3.mean(rows, d => +d["Bonus"]);
                    
                    const ranks = rows.map(row => ({
                        name: row["Role Rank Name"],
                        rank: +row["Role Rank"],
                        value: +row["Total Pay"],
                        basePay: +row["Base Pay"],
                        stock: +row["Stock"],
                        bonus: +row["Bonus"]
                    })).sort((a, b) => a.value - b.value);

                    return {
                        name: roleName,
                        avgPay: avgPay,
                        avgBase: avgBase,
                        avgStock: avgStock,
                        avgBonus: avgBonus,
                        children: ranks
                    };
                }).sort((a, b) => a.avgPay - b.avgPay);

                return {
                    name: ticker,
                    children: roles
                };
            });

            vis.updateVis();
        });
    }

    updateVis() {
        const vis = this;

        const companyData = vis.allCompaniesData.find(c => c.name === vis.currentTicker);

        const hierarchy = d3.hierarchy(companyData)
            .sum(d => d.value);
        
        hierarchy.each(d => {
            if (d.depth === 1 && d.data.avgPay) {
                const oldValue = d.value;
                d.value = d.data.avgPay;
                if (d.children) {
                    const scale = d.value / oldValue;
                    d.children.forEach(child => {
                        child.value *= scale;
                    });
                }
            }
        });
        
        hierarchy.value = d3.sum(hierarchy.children, d => d.value);

        const partition = d3.partition()
            .size([2 * Math.PI, vis.radius]);

        const root = partition(hierarchy);
        
        root.each(d => {
            const offset = -Math.PI / 2;
            const temp0 = d.x0;
            const temp1 = d.x1;
            d.x0 = temp0 + offset;
            d.x1 = temp1 + offset;
        });
        
        const allRankValues = [];
        root.descendants().filter(d => d.depth === 2).forEach(d => {
            allRankValues.push(d.data.value);
        });
        const maxRankValue = d3.max(allRankValues);
        
        const rankRadiusScale = d3.scaleSqrt()
            .domain([0, maxRankValue])
            .range([0, vis.radius * 0.4]);

        vis.g.selectAll("path").remove();
        vis.g.selectAll("g").remove();
        vis.g.selectAll(".legend").remove();

        const path = vis.g.append("g")
            .selectAll("path")
            .data(root.descendants().filter(d => d.depth === 1 && d.x1 - d.x0 > 0.001))
            .join("path")
            .attr("fill", d => vis.color(d.data.name))
            .attr("d", vis.arc);
        
        const rankNodes = root.descendants().filter(d => d.depth === 2 && d.x1 - d.x0 > 0.001);
        const stackColors = {
            base: "#4CAF50",
            stock: "#FFD700",
            bonus: "#DC143C"
        };
        
        rankNodes.forEach(d => {
            const parentY1 = d.parent.y1;
            const baseHeight = rankRadiusScale(d.data.basePay);
            const stockHeight = rankRadiusScale(d.data.stock);
            const bonusHeight = rankRadiusScale(d.data.bonus);
            
            const segments = [
                { name: "base", y0: parentY1, y1: parentY1 + baseHeight, color: stackColors.base },
                { name: "stock", y0: parentY1 + baseHeight, y1: parentY1 + baseHeight + stockHeight, color: stackColors.stock },
                { name: "bonus", y0: parentY1 + baseHeight + stockHeight, y1: parentY1 + baseHeight + stockHeight + bonusHeight, color: stackColors.bonus }
            ];
            
            const totalHeight = baseHeight + stockHeight + bonusHeight;
            const rankId = `${d.parent.data.name}-${d.data.name}`;
            
            // Create visual segments without individual hover events
            segments.forEach(seg => {
                if (seg.y1 - seg.y0 > 0) {
                    const segArc = d3.arc()
                        .startAngle(d.x0)
                        .endAngle(d.x1)
                        .innerRadius(seg.y0)
                        .outerRadius(seg.y1);
                    
                    vis.g.append("path")
                        .datum(d)
                        .attr("d", segArc)
                        .attr("fill", seg.color)
                        .attr("stroke", "white")
                        .attr("stroke-width", 0.5)
                        .attr("class", "rank-segment")
                        .attr("data-parent-role", d.parent.data.name)
                        .attr("data-rank-id", rankId);
                }
            });
            
            // Create invisible overlay for the entire rank bar to handle hover
            if (totalHeight > 0) {
                const overlayArc = d3.arc()
                    .startAngle(d.x0)
                    .endAngle(d.x1)
                    .innerRadius(parentY1)
                    .outerRadius(parentY1 + totalHeight);
                
                vis.g.append("path")
                    .datum(d)
                    .attr("d", overlayArc)
                    .attr("fill", "transparent")
                    .style("cursor", "pointer")
                    .attr("class", "rank-overlay")
                    .attr("data-rank-id", rankId)
                    .on("mouseenter", (event) => {
                        path.attr("fill-opacity", node => node === d.parent ? 1.0 : 0.3);
                        vis.g.selectAll(".rank-segment").attr("fill-opacity", function() {
                            return d3.select(this).attr("data-rank-id") === rankId ? 1.0 : 0.3;
                        });
                        
                        const basePct = (d.data.basePay / d.data.value * 100).toFixed(1);
                        const stockPct = (d.data.stock / d.data.value * 100).toFixed(1);
                        const bonusPct = (d.data.bonus / d.data.value * 100).toFixed(1);
                        
                        vis.g.selectAll(".role-name-line").remove();
                        const roleLines = d.parent.data.name.split("-");
                        const baseY = roleLines.length === 1 ? -40 : -40 - (roleLines.length - 1) * 9;
                        roleLines.forEach((line, i) => {
                            vis.g.append("text")
                                .attr("class", "role-name-line")
                                .attr("text-anchor", "middle")
                                .attr("y", baseY + i * 18)
                                .attr("font-size", "1.1em")
                                .attr("fill", "#e0e0e0")
                                .style("pointer-events", "none")
                                .text(line);
                        });
                        
                        vis.label.select(".rank-name").text(d.data.name);
                        vis.label.select(".pay-amount").text(`$${Math.round(d.data.value).toLocaleString()}`);
                        vis.label.select(".base-info").text(`Base: $${Math.round(d.data.basePay).toLocaleString()} (${basePct}%)`);
                        vis.label.select(".stock-info").text(`Stock: $${Math.round(d.data.stock).toLocaleString()} (${stockPct}%)`);
                        vis.label.select(".bonus-info").text(`Bonus: $${Math.round(d.data.bonus).toLocaleString()} (${bonusPct}%)`);
                    })
                    .on("mouseleave", () => {
                        path.attr("fill-opacity", 1);
                        vis.g.selectAll(".rank-segment").attr("fill-opacity", 1);
                        
                        vis.g.selectAll(".role-name-line").remove();
                        vis.label.select(".rank-name").text("");
                        vis.label.select(".pay-amount").text("");
                        vis.label.select(".base-info").text("");
                        vis.label.select(".stock-info").text("");
                        vis.label.select(".bonus-info").text("");
                    });
            }
        });

        const companyName = vis.companyInfoMap.get(companyData.name) || companyData.name;
        vis.label.style("visibility", null);
        
        vis.g.selectAll(".company-name-line").remove();
        const companyWords = companyName.split(" ");
        const maxWordsPerLine = 3;
        const companyLines = [];
        for (let i = 0; i < companyWords.length; i += maxWordsPerLine) {
            companyLines.push(companyWords.slice(i, i + maxWordsPerLine).join(" "));
        }
        
        companyLines.forEach((line, i) => {
            vis.g.append("text")
                .attr("class", "company-name-line")
                .attr("text-anchor", "middle")
                .attr("y", -70 + i * 25)
                .attr("font-size", "1.4em")
                .attr("font-weight", "bold")
                .attr("fill", "#e0e0e0")
                .style("pointer-events", "none")
                .text(line);
        });
        
        root.descendants().filter(d => d.depth === 1 && d.x1 - d.x0 > 0.001).forEach(d => {
            const angle = (d.x0 + d.x1) / 2;
            const radius = (d.y0 + d.y1) / 2;
            const x = Math.sin(angle) * radius;
            const y = -Math.cos(angle) * radius;
            
            const lines = d.data.name.split("-");
            const textGroup = vis.g.append("g")
                .attr("transform", `translate(${x},${y})`);
            
            lines.forEach((line, i) => {
                textGroup.append("text")
                    .attr("text-anchor", "middle")
                    .attr("y", (i - (lines.length - 1) / 2) * 12)
                    .attr("font-size", "10px")
                    .attr("fill", "white")
                    .attr("font-weight", "bold")
                    .style("pointer-events", "none")
                    .text(line);
            });
        });
        
        const legendX = vis.width / 2 - 120;
        const legendY = -vis.height / 2 + 40;
        const legendData = [
            { label: "Base Pay", color: "#4CAF50" },
            { label: "Stock", color: "#FFD700" },
            { label: "Bonus", color: "#DC143C" }
        ];
        
        const legend = vis.g.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${legendX}, ${legendY})`);
        
        legendData.forEach((item, i) => {
            const legendItem = legend.append("g")
                .attr("transform", `translate(0, ${i * 25})`);
            
            legendItem.append("rect")
                .attr("width", 18)
                .attr("height", 18)
                .attr("fill", item.color);
            
            legendItem.append("text")
                .attr("x", 25)
                .attr("y", 14)
                .attr("font-size", "14px")
                .attr("fill", "#e0e0e0")
                .text(item.label);
        });

        const interactionLayer = vis.g.append("g")
            .attr("class", "interaction-layer")
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("mouseleave", () => {
                path.attr("fill-opacity", 1);
                vis.g.selectAll(".rank-segment").attr("fill-opacity", 1);
                vis.g.selectAll(".role-name-line").remove();
                vis.label.select(".rank-name").text("");
                vis.label.select(".pay-amount").text("");
                vis.label.select(".base-info").text("");
                vis.label.select(".stock-info").text("");
                vis.label.select(".bonus-info").text("");
            });

        interactionLayer.selectAll("path")
            .data(root.descendants().filter(d => d.depth === 1 && d.x1 - d.x0 > 0.001))
            .join("path")
            .attr("d", vis.mousearc)
            .on("mouseenter", (event, d) => {
                const sequence = d.ancestors().reverse().slice(1);
                path.attr("fill-opacity", node => sequence.indexOf(node) >= 0 ? 1.0 : 0.3);
                vis.g.selectAll(".rank-segment").attr("fill-opacity", function() {
                    return d3.select(this).attr("data-parent-role") === d.data.name ? 1.0 : 0.3;
                });

                const basePct = (d.data.avgBase / d.data.avgPay * 100).toFixed(1);
                const stockPct = (d.data.avgStock / d.data.avgPay * 100).toFixed(1);
                const bonusPct = (d.data.avgBonus / d.data.avgPay * 100).toFixed(1);
                
                vis.g.selectAll(".role-name-line").remove();
                const roleLines = d.data.name.split("-");
                const baseY = roleLines.length === 1 ? -40 : -40 - (roleLines.length - 1) * 9;
                roleLines.forEach((line, i) => {
                    vis.g.append("text")
                        .attr("class", "role-name-line")
                        .attr("text-anchor", "middle")
                        .attr("y", baseY + i * 18)
                        .attr("font-size", "1.1em")
                        .attr("fill", "#e0e0e0")
                        .style("pointer-events", "none")
                        .text(line);
                });
                
                vis.label.select(".rank-name").text("Average Pay");
                vis.label.select(".pay-amount").text(`$${Math.round(d.data.avgPay).toLocaleString()}`);
                vis.label.select(".base-info").text(`Base: $${Math.round(d.data.avgBase).toLocaleString()} (${basePct}%)`);
                vis.label.select(".stock-info").text(`Stock: $${Math.round(d.data.avgStock).toLocaleString()} (${stockPct}%)`);
                vis.label.select(".bonus-info").text(`Bonus: $${Math.round(d.data.avgBonus).toLocaleString()} (${bonusPct}%)`);
            });
    }
}
