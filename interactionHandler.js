// Interaction and highlighting logic for the visualization

/**
 * Highlights a specific role and shows its associated ranks
 * 
 * @param {Object} svg - D3 selection of the SVG element
 * @param {string} roleName - Name of the role to highlight
 * @param {Array} ranks - Array of all rank objects
 */
function highlightRole(svg, roleName, ranks) {
    // Get the indices of ranks that belong to this role
    const roleRankIndices = new Set();
    ranks.forEach((rank, idx) => {
        if (rank.roleName === roleName) {
            roleRankIndices.add(idx);
        }
    });
    
    // Apply collision detection ONLY to rank bubbles for this role
    const c = SLOPE_CHART_CONSTANTS;
    const bubbleHeight = c.bubbleHeight;
    const bubbleMinSpacing = c.bubbleMinSpacing;
    const visibleRankBubbles = applyRankBubbleCollisions(svg, roleName, bubbleHeight, bubbleMinSpacing);
    
    // Update positions of visible rank bubbles
    updateRankBubblePositions(svg, visibleRankBubbles);
    
    // Grey out all role dots except the hovered one
    svg.selectAll(".role-dot")
        .transition()
        .duration(200)
        .style("opacity", d => d.name === roleName ? 1 : 0.2);
    
    // Grey out all role label bubbles except the hovered one
    svg.selectAll(".role-label-bubble")
        .transition()
        .duration(200)
        .style("opacity", function() {
            const bubbleRole = d3.select(this).attr("data-role");
            return bubbleRole === roleName ? 1 : 0.2;
        });
    
    // Grey out role connectors
    svg.selectAll(".role-connector")
        .transition()
        .duration(200)
        .style("opacity", function() {
            const connectorRole = d3.select(this).attr("data-role");
            return connectorRole === roleName ? 0.6 : 0.1;
        });
    
    // Hide all rank dots except those belonging to this role
    svg.selectAll(".rank-dot")
        .transition()
        .duration(200)
        .style("opacity", (d, i) => roleRankIndices.has(i) ? 1 : 0);
    
    // Show rank label bubbles only for this role
    svg.selectAll(".rank-label-bubble")
        .transition()
        .duration(200)
        .style("opacity", function() {
            const rankIndex = parseInt(d3.select(this).attr("data-rank-index"));
            return roleRankIndices.has(rankIndex) ? 1 : 0;
        })
        .on("end", function() {
            // Enable/disable pointer events based on visibility
            const rankIndex = parseInt(d3.select(this).attr("data-rank-index"));
            d3.select(this).style("pointer-events", roleRankIndices.has(rankIndex) ? "all" : "none");
        });
    
    // Show rank connectors only for this role
    svg.selectAll(".rank-connector")
        .transition()
        .duration(200)
        .style("opacity", function() {
            const rankIndex = parseInt(d3.select(this).attr("data-rank-index"));
            return roleRankIndices.has(rankIndex) ? 0.6 : 0;
        });
    
    // Highlight connection lines for this role
    svg.selectAll(".connection-line")
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

/**
 * Resets all highlighting and returns visualization to default state
 * 
 * @param {Object} svg - D3 selection of the SVG element
 */
function resetHighlight(svg) {
    const c = SLOPE_CHART_CONSTANTS;
    
    // Reset all role dots
    svg.selectAll(".role-dot")
        .transition()
        .duration(200)
        .style("opacity", 1);
    
    // Reset all role label bubbles
    svg.selectAll(".role-label-bubble")
        .transition()
        .duration(200)
        .style("opacity", 1);
    
    // Reset role connectors
    svg.selectAll(".role-connector")
        .transition()
        .duration(200)
        .style("opacity", 0.4);
    
    // Reset all rank dots
    svg.selectAll(".rank-dot")
        .transition()
        .duration(200)
        .style("opacity", 1);
    
    // Hide all rank label bubbles and reset positions
    svg.selectAll(".rank-label-bubble").each((d, i, nodes) => {
        const bubble = d3.select(nodes[i]);
        const originalRectY = parseFloat(bubble.attr("data-original-rect-y"));
        const originalTextY = parseFloat(bubble.attr("data-original-text-y"));
        
        // Reset rect position to original
        bubble.select("rect")
            .transition()
            .duration(200)
            .attr("y", originalRectY);
        
        // Reset text position to original
        bubble.select("text")
            .transition()
            .duration(200)
            .attr("y", originalTextY);
        
        // Hide bubble
        bubble.transition()
            .duration(200)
            .style("opacity", 0)
            .on("end", function() {
                // Disable pointer events when hidden
                d3.select(this).style("pointer-events", "none");
            });
    });
    
    // Hide rank connectors and reset paths
    svg.selectAll(".rank-connector").each(function() {
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
    svg.selectAll(".connection-line")
        .transition()
        .duration(200)
        .attr("stroke-opacity", c.lineOpacity)
        .attr("stroke-width", c.lineWidth);
}

