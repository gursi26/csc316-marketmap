// Collision detection and resolution for bubble labels

/**
 * Resolves collisions between bubbles using bottom-justified approach
 * Bubbles are sorted from bottom to top, and collisions are resolved by pushing bubbles upward
 * 
 * @param {Array} bubbleData - Array of bubble objects with {dotY, bubbleY, height} properties
 * @param {number} bubbleHeight - Height of each bubble
 * @param {number} minSpacing - Minimum spacing between bubbles
 * @returns {Array} - Sorted array with adjusted bubbleY positions
 */
function resolveBottomJustifiedCollisions(bubbleData, bubbleHeight, minSpacing) {
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
}

/**
 * Applies collision detection to visible rank bubbles for a specific item (role or company)
 * Updates bubble positions directly in the DOM
 * 
 * @param {Object} svg - D3 selection of the SVG element
 * @param {string} itemName - Name of the item to process (role or company)
 * @param {number} bubbleHeight - Height of each bubble
 * @param {number} minSpacing - Minimum spacing between bubbles
 * @param {string} viewMode - Current view mode ('company' or 'role'), defaults to 'company'
 * @returns {Array} - Array of visible rank bubble data with adjusted positions
 */
function applyRankBubbleCollisions(svg, itemName, bubbleHeight, minSpacing, viewMode = 'company') {
    const visibleRankBubbles = [];
    
    // Collect only the bubbles for this item
    svg.selectAll(".rank-label-bubble").each(function() {
        const bubble = d3.select(this);
        const groupKey = bubble.attr("data-group-key");
        const rankIndex = parseInt(bubble.attr("data-rank-index"));
        
        if (groupKey === itemName) {
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
        
        if (nextBottom + minSpacing > currentTop) {
            next.bubbleY = currentTop - minSpacing - bubbleHeight / 2;
        }
    }
    
    return visibleRankBubbles;
}

/**
 * Updates positions of rank bubbles and their connectors after collision resolution
 * 
 * @param {Object} svg - D3 selection of the SVG element
 * @param {Array} bubbleData - Array of bubble data with adjusted positions
 */
function updateRankBubblePositions(svg, bubbleData) {
    bubbleData.forEach(item => {
        const bubble = d3.select(item.element);
        const offset = item.bubbleY - item.dotY;
        
        // Update the rect position directly
        bubble.select("rect")
            .attr("y", function() {
                const currentY = parseFloat(d3.select(this).attr("y"));
                return currentY + offset;
            });
        
        // Update the text position directly
        bubble.select("text")
            .attr("y", function() {
                const currentY = parseFloat(d3.select(this).attr("y"));
                return currentY + offset;
            });
        
        // Update the connector arrow
        const connector = svg.select(`.rank-connector[data-rank-index="${item.rankIndex}"]`);
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
}

