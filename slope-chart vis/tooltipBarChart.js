// Tooltip stacked bar chart component using D3
class TooltipBarChart {
    constructor(parentElement) {
        this.parentElement = parentElement;
        this.width = SLOPE_CHART_CONSTANTS.tooltipStackedBarWidth;
        this.height = 25;
        this.barHeight = 20;
        this.data = [];
        
        this.initVis();
    }
    
    initVis() {
        const vis = this;
        
        // Create SVG
        vis.svg = d3.select(vis.parentElement)
            .append('svg')
            .attr('width', vis.width)
            .attr('height', vis.height);
    }
    
    wrangleData(basePercent, stockPercent, bonusPercent) {
        const vis = this;
        
        // Round percentages to integers and ensure they sum to 100
        let base = Math.round(basePercent);
        let stock = Math.round(stockPercent);
        let bonus = Math.round(bonusPercent);
        
        // Adjust to ensure sum is 100
        const total = base + stock + bonus;
        if (total !== 100) {
            const diff = 100 - total;
            // Add difference to the largest component
            if (base >= stock && base >= bonus) base += diff;
            else if (stock >= bonus) stock += diff;
            else bonus += diff;
        }
        
        // Calculate cumulative positions
        vis.data = [
            { type: 'base', value: base, x0: 0, x1: base, color: '#50C878' },
            { type: 'stock', value: stock, x0: base, x1: base + stock, color: '#F5A623' },
            { type: 'bonus', value: bonus, x0: base + stock, x1: 100, color: '#E94B3C' }
        ];
        
        vis.updateVis();
    }
    
    updateVis() {
        const vis = this;
        
        // Create scale for horizontal position
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, vis.width]);
        
        // Draw stacked bar segments
        vis.svg.selectAll('.bar-segment')
            .data(vis.data)
            .join('rect')
            .attr('class', 'bar-segment')
            .attr('x', d => xScale(d.x0))
            .attr('y', 0)
            .attr('width', d => xScale(d.value))
            .attr('height', vis.barHeight)
            .attr('fill', d => d.color)
            .attr('rx', (d, i) => {
                // Round left corners for first segment, right corners for last
                if (i === 0) return 3;
                if (i === vis.data.length - 1) return 3;
                return 0;
            });
        
        // Draw percentage labels inside segments
        vis.data.forEach(d => {
            if (d.value > 2) { // Only show if segment is large enough
                const centerX = xScale(d.x0 + d.value / 2);
                
                // Add text (centered)
                vis.svg.append('text')
                    .attr('class', 'bar-text')
                    .attr('x', centerX)
                    .attr('y', vis.barHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('font-size', '11px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#1a1a1a')
                    .text(d.value);
            }
        });
    }
}

