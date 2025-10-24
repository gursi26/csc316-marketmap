// Bubble rendering logic for role and rank labels

/**
 * Creates and renders role label bubbles with collision detection
 * 
 * @param {Object} svg - D3 selection of the SVG element
 * @param {Array} roles - Array of role objects
 * @param {Function} roleScale - D3 scale for positioning roles by pay
 * @param {Function} roleColorScale - D3 color scale for roles
 * @param {number} leftX - X position of the role line
 * @param {Object} handlers - Object containing click and hover event handlers
 */
function renderRoleBubbles(svg, roles, roleScale, roleColorScale, leftX, handlers) {
    const c = SLOPE_CHART_CONSTANTS;
    const bubbleHeight = c.bubbleHeight;
    const bubblePadding = c.bubblePadding;
    const bubbleMinSpacing = c.bubbleMinSpacing;
    const bubbleRightEdge = leftX - c.bubbleConnectorGap;
    
    // Prepare bubble data with initial positions
    const roleBubbleData = roles.map((role) => {
        const text = formatRoleName(role.name);
        
        // Create temporary text element to measure actual width
        const tempText = svg.append("text")
            .attr("font-size", c.bubbleFontSize)
            .text(text)
            .style("visibility", "hidden");
        
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        
        const bubbleWidth = textWidth + bubblePadding * 2;
        
        return {
            role: role,
            text: text,
            width: bubbleWidth,
            dotY: roleScale(role.avgPay),
            bubbleY: roleScale(role.avgPay),
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
        const bubbleX = bubbleRightEdge - bubbleWidth;
        
        // Draw bubble group
        const bubbleGroup = svg.append("g")
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
            .attr("stroke", roleColorScale(role.name))
            .attr("stroke-width", 1.5);
        
        bubbleGroup.append("text")
            .attr("x", bubbleX + bubbleWidth / 2)
            .attr("y", bubbleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", c.bubbleFontSize)
            .attr("fill", "#333")
            .text(item.text)
            .style("pointer-events", "none");
        
        // Add event handlers
        bubbleGroup
            .on("click", (event) => handlers.onClick(event, role))
            .on("mouseenter", (event) => {
                handlers.onMouseEnter(event, role);
                showRoleTooltip(role, event.clientX, event.clientY);
            })
            .on("mousemove", (event) => {
                updateTooltipPosition(event.clientX, event.clientY);
            })
            .on("mouseleave", () => {
                handlers.onMouseLeave();
                hideTooltip();
            });
        
        // Draw curved arrow from bubble to dot
        const arrowStart = bubbleRightEdge;
        const arrowEnd = leftX;
        const controlX = (arrowStart + arrowEnd) / 2;
        
        svg.append("path")
            .attr("class", "role-connector")
            .attr("data-role", role.name)
            .attr("d", `M ${arrowStart} ${bubbleY} Q ${controlX} ${(bubbleY + dotY) / 2}, ${arrowEnd} ${dotY}`)
            .attr("stroke", roleColorScale(role.name))
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("opacity", 0.4);
    });
}

/**
 * Creates and renders rank label bubbles (initially hidden)
 * 
 * @param {Object} svg - D3 selection of the SVG element
 * @param {Array} ranks - Array of rank objects
 * @param {Function} rankScale - D3 scale for positioning ranks by pay
 * @param {Function} roleColorScale - D3 color scale for roles
 * @param {number} rightX - X position of the rank line
 */
function renderRankBubbles(svg, ranks, rankScale, roleColorScale, rightX) {
    const c = SLOPE_CHART_CONSTANTS;
    const bubbleHeight = c.bubbleHeight;
    const bubblePadding = c.bubblePadding;
    const rankBubbleLeftEdge = rightX + c.bubbleConnectorGap;
    
    ranks.forEach((rank, idx) => {
        const text = rank.rankName;
        
        // Create temporary text element to measure actual width
        const tempText = svg.append("text")
            .attr("font-size", c.bubbleFontSize)
            .text(text)
            .style("visibility", "hidden");
        
        const textWidth = tempText.node().getBBox().width;
        tempText.remove();
        
        const bubbleWidth = textWidth + bubblePadding * 2;
        const dotY = rankScale(rank.totalPay);
        const bubbleY = dotY;
        const rankBubbleX = rankBubbleLeftEdge;
        
        // Draw bubble group
        const bubbleGroup = svg.append("g")
            .attr("class", "rank-label-bubble")
            .attr("data-rank-index", idx)
            .attr("data-role-name", rank.roleName)
            .attr("data-original-rect-y", bubbleY - bubbleHeight / 2)
            .attr("data-original-text-y", bubbleY)
            .style("opacity", 0)
            .style("cursor", "pointer")
            .style("pointer-events", "none"); // Disable interactions when invisible
        
        bubbleGroup.append("rect")
            .attr("x", rankBubbleX)
            .attr("y", bubbleY - bubbleHeight / 2)
            .attr("width", bubbleWidth)
            .attr("height", bubbleHeight)
            .attr("rx", 8)
            .attr("fill", "white")
            .attr("stroke", roleColorScale(rank.roleName))
            .attr("stroke-width", 1.5);
        
        bubbleGroup.append("text")
            .attr("x", rankBubbleX + bubbleWidth / 2)
            .attr("y", bubbleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", c.bubbleFontSize)
            .attr("fill", "#333")
            .text(text)
            .style("pointer-events", "none");
        
        // Add event handlers for tooltip
        bubbleGroup
            .on("mouseenter", (event) => {
                showRankTooltip(rank, event.clientX, event.clientY);
            })
            .on("mousemove", (event) => {
                updateTooltipPosition(event.clientX, event.clientY);
            })
            .on("mouseleave", () => {
                hideTooltip();
            });
        
        // Draw curved arrow from dot to bubble
        const arrowStart = rightX;
        const arrowEnd = rankBubbleX;
        const controlX = (arrowStart + arrowEnd) / 2;
        
        svg.append("path")
            .attr("class", "rank-connector")
            .attr("data-rank-index", idx)
            .attr("data-role-name", rank.roleName)
            .attr("d", `M ${arrowStart} ${dotY} Q ${controlX} ${(dotY + bubbleY) / 2}, ${arrowEnd} ${bubbleY}`)
            .attr("stroke", roleColorScale(rank.roleName))
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("opacity", 0)
            .style("opacity", 0);
    });
}

