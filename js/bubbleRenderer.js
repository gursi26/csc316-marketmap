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
 * @param {string} viewMode - Current view mode ('company' or 'role')
 */
function renderRoleBubbles(svg, roles, roleScale, roleColorScale, leftX, handlers, viewMode = 'company') {
    const c = SLOPE_CHART_CONSTANTS;
    const isRoleView = viewMode === 'role';
    const bubbleHeight = isRoleView ? c.logoBubbleSize : c.bubbleHeight;
    const bubblePadding = c.bubblePadding;
    const bubbleMinSpacing = c.bubbleMinSpacing;
    const bubbleRightEdge = leftX - c.bubbleConnectorGap;
    
    // Prepare bubble data with initial positions
    const roleBubbleData = roles.map((role) => {
        const text = role.displayName ? role.displayName : formatRoleName(role.name);
        let bubbleWidth;
        
        if (isRoleView) {
            // For role view (companies), use square bubbles for logos
            bubbleWidth = c.logoBubbleSize;
        } else {
            // For company view (roles), measure text width
            const tempText = svg.append("text")
                .attr("font-size", c.bubbleFontSize)
                .text(text)
                .style("visibility", "hidden");
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            bubbleWidth = textWidth + bubblePadding * 2;
        }
        
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
            .attr("rx", isRoleView ? 6 : 8)
            .attr("fill", isRoleView ? "#ffffff" : "#2a2a2a")
            .attr("stroke", roleColorScale(role.name))
            .attr("stroke-width", 1.5);
        
        if (isRoleView) {
            // For role view, show company logo
            const ticker = role.name; // In role view, role.name is the company ticker
            const logoPath = `../dataset/logos/images/${ticker}.png`;
            
            // Add logo image
            bubbleGroup.append("image")
                .attr("href", logoPath)
                .attr("x", bubbleX + c.logoPadding)
                .attr("y", bubbleY - c.logoSize / 2)
                .attr("width", c.logoSize)
                .attr("height", c.logoSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .style("pointer-events", "none")
                .on("error", function() {
                    // Fallback to text if image fails to load
                    d3.select(this).remove();
                    bubbleGroup.append("text")
                        .attr("x", bubbleX + bubbleWidth / 2)
                        .attr("y", bubbleY)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", c.bubbleFontSize)
                        .attr("fill", "#e0e0e0")
                        .text(ticker)
                        .style("pointer-events", "none");
                });
        } else {
            // For company view, show role name as text
            bubbleGroup.append("text")
                .attr("x", bubbleX + bubbleWidth / 2)
                .attr("y", bubbleY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", c.bubbleFontSize)
                .attr("fill", "#e0e0e0")
                .text(item.text)
                .style("pointer-events", "none");
        }
        
        // Add event handlers
        bubbleGroup
            .on("click", (event) => handlers.onClick(event, role))
            .on("dblclick", (event) => {
                if (handlers.onDblClick) {
                    handlers.onDblClick(event, role);
                }
            })
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
function renderRankBubbles(svg, ranks, rankScale, roleColorScale, rightX, viewMode = 'company') {
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
        
        // Get the appropriate grouping key based on view mode
        const groupKey = viewMode === 'company' ? rank.roleName : rank.companyName;
        
        // Draw bubble group
        const bubbleGroup = svg.append("g")
            .attr("class", "rank-label-bubble")
            .attr("data-rank-index", idx)
            .attr("data-group-key", groupKey)
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
            .attr("fill", "#2a2a2a")
            .attr("stroke", roleColorScale(groupKey))
            .attr("stroke-width", 1.5);
        
        bubbleGroup.append("text")
            .attr("x", rankBubbleX + bubbleWidth / 2)
            .attr("y", bubbleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", c.bubbleFontSize)
            .attr("fill", "#e0e0e0")
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
        const arrowEnd = rankBubbleX - 1; // Extend slightly into bubble for better visual connection
        const controlX = (arrowStart + arrowEnd) / 2;
        
        svg.append("path")
            .attr("class", "rank-connector")
            .attr("data-rank-index", idx)
            .attr("data-role-name", rank.roleName || '') // Optional in role view
            .attr("d", `M ${arrowStart} ${dotY} Q ${controlX} ${(dotY + bubbleY) / 2}, ${arrowEnd} ${bubbleY}`)
            .attr("stroke", roleColorScale(groupKey)) // Use groupKey for color
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("opacity", 0)
            .style("opacity", 0);
    });
}

