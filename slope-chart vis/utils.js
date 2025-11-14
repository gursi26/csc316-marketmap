// Utility functions for the compensation visualization

// Track preferred tooltip side
let tooltipSide = 'right';

/**
 * Formats a role name from kebab-case to Title Case
 * @param {string} roleName - The role name to format (e.g., "software-engineer")
 * @returns {string} - Formatted role name (e.g., "Software Engineer")
 */
function formatRoleName(roleName) {
    return roleName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Creates a kernel density estimator function
 * @param {Function} kernel - The kernel function to use
 * @param {Array} thresholds - Array of threshold values
 * @returns {Function} - Density estimator function
 */
function kernelDensityEstimator(kernel, thresholds) {
    return function(values) {
        return thresholds.map(t => [t, d3.sum(values, v => kernel(t - v))]);
    };
}

/**
 * Gaussian kernel function for density estimation
 * @param {number} bandwidth - The bandwidth parameter
 * @returns {Function} - Gaussian kernel function
 */
function kernelGaussian(bandwidth) {
    return function(v) {
        const z = v / bandwidth;
        return (1 / (bandwidth * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
    };
}

/**
 * Sets up consistent color scale for roles
 * @param {Array} allRoles - Array of all unique role names
 * @returns {Function} - D3 ordinal color scale
 */
function setupRoleColorScale(allRoles) {
    return d3.scaleOrdinal()
        .domain(allRoles.sort())
        .range(d3.schemeTableau10.concat(d3.schemePaired));
}

/**
 * Formats a number as currency
 * @param {number} value - The value to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(value) {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}k`;
    } else {
        return `$${value.toFixed(0)}`;
    }
}

/**
 * Shows tooltip with role compensation data
 * @param {Object} role - Role data object
 * @param {number} x - X position for tooltip
 * @param {number} y - Y position for tooltip
 */
function showRoleTooltip(role, x, y) {
    const tooltip = document.getElementById('tooltip');
    const total = role.avgPay;
    
    // Title is always the company name
    const companyName = role.companyDisplayName || role.displayName || role.companyName || role.name;
    // Subtitle is always the role name
    const roleName = role.roleName || role.name;
    const roleDisplayName = formatRoleName(roleName);
    
    const basePercent = ((role.avgBase / total) * 100).toFixed(1);
    const stockPercent = ((role.avgStock / total) * 100).toFixed(1);
    const bonusPercent = ((role.avgBonus / total) * 100).toFixed(1);
    
    const html = `
        <div class="tooltip-title">${companyName}</div>
        <div class="tooltip-subtitle">${roleDisplayName}</div>
        <div class="tooltip-data">
            <div class="tooltip-row">
                <span class="label">Avg Pay:</span>
                <span class="value">${formatCurrency(total)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label"><span class="legend-box" style="background-color: #50C878;"></span>Avg Base:</span>
                <span class="value">${formatCurrency(role.avgBase)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label"><span class="legend-box" style="background-color: #F5A623;"></span>Avg Stock:</span>
                <span class="value">${formatCurrency(role.avgStock)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label"><span class="legend-box" style="background-color: #E94B3C;"></span>Avg Bonus:</span>
                <span class="value">${formatCurrency(role.avgBonus)}</span>
            </div>
        </div>
        <div class="tooltip-chart"></div>
    `;
    
    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    
    // Create and render the bar chart
    const chart = new TooltipBarChart('.tooltip-chart');
    chart.wrangleData(parseFloat(basePercent), parseFloat(stockPercent), parseFloat(bonusPercent));
    
    // Set preferred side and update position
    tooltipSide = 'left';
    updateTooltipPosition(x, y, tooltipSide);
}

/**
 * Hides the tooltip
 */
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('visible');
}

/**
 * Shows tooltip with rank compensation data
 * @param {Object} rank - Rank data object
 * @param {number} x - X position for tooltip
 * @param {number} y - Y position for tooltip
 */
function showRankTooltip(rank, x, y) {
    const tooltip = document.getElementById('tooltip');
    const total = rank.totalPay;
    
    // Title is always company name
    const companyName = rank.companyDisplayName || rank.companyName;
    // Subtitle 1 is role name (smaller font)
    const roleName = formatRoleName(rank.roleName);
    // Subtitle 2 is rank name (smaller font)
    const rankName = rank.rankName;
    
    const basePercent = ((rank.basePay / total) * 100).toFixed(1);
    const stockPercent = ((rank.stock / total) * 100).toFixed(1);
    const bonusPercent = ((rank.bonus / total) * 100).toFixed(1);
    
    const html = `
        <div class="tooltip-title">${companyName}</div>
        <div class="tooltip-subtitle">${roleName}</div>
        <div class="tooltip-subtitle">${rankName}</div>
        <div class="tooltip-data">
            <div class="tooltip-row">
                <span class="label">Total Pay:</span>
                <span class="value">${formatCurrency(total)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label"><span class="legend-box" style="background-color: #50C878;"></span>Base Pay:</span>
                <span class="value">${formatCurrency(rank.basePay)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label"><span class="legend-box" style="background-color: #F5A623;"></span>Stock:</span>
                <span class="value">${formatCurrency(rank.stock)}</span>
            </div>
            <div class="tooltip-row">
                <span class="label"><span class="legend-box" style="background-color: #E94B3C;"></span>Bonus:</span>
                <span class="value">${formatCurrency(rank.bonus)}</span>
            </div>
        </div>
        <div class="tooltip-chart"></div>
    `;
    
    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    
    // Create and render the bar chart
    const chart = new TooltipBarChart('.tooltip-chart');
    chart.wrangleData(parseFloat(basePercent), parseFloat(stockPercent), parseFloat(bonusPercent));
    
    // Set preferred side and update position
    tooltipSide = 'right';
    updateTooltipPosition(x, y, tooltipSide);
}

/**
 * Updates tooltip position dynamically based on cursor location
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} side - Preferred side ('left' or 'right', optional)
 */
function updateTooltipPosition(x, y, side = null) {
    // Use stored side preference if not explicitly provided
    if (!side) {
        side = tooltipSide;
    }
    
    const tooltip = document.getElementById('tooltip');
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default offset from cursor
    const offsetX = 15;
    const offsetY = 15;
    
    // Calculate position based on preferred side
    let left, top;
    
    if (side === 'left') {
        // Position on the left of cursor
        left = x - tooltipRect.width - offsetX;
        // Ensure it doesn't go off the left edge
        if (left < 0) {
            left = x + offsetX;
        }
    } else {
        // Position on the right of cursor (default)
        left = x + offsetX;
        // Check if tooltip would go off the right edge
        if (left + tooltipRect.width > viewportWidth) {
            left = x - tooltipRect.width - offsetX;
        }
    }
    
    top = y + offsetY;
    
    // Check if tooltip would go off the bottom edge
    if (top + tooltipRect.height > viewportHeight) {
        top = y - tooltipRect.height - offsetY;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

/**
 * Shows info popup with text
 * @param {string} text - The text to display
 * @param {number} x - X position for popup
 * @param {number} y - Y position for popup
 */
function showInfoPopup(text, x, y) {
    const popup = document.getElementById('info-popup');
    popup.textContent = text;
    popup.classList.add('visible');
    updateInfoPopupPosition(x, y);
}

/**
 * Hides the info popup
 */
function hideInfoPopup() {
    const popup = document.getElementById('info-popup');
    popup.classList.remove('visible');
}

/**
 * Updates info popup position
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function updateInfoPopupPosition(x, y) {
    const popup = document.getElementById('info-popup');
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const offsetX = 15;
    const offsetY = 15;
    
    let left = x + offsetX;
    let top = y + offsetY;
    
    // Check if popup would go off the right edge
    if (left + popupRect.width > viewportWidth) {
        left = x - popupRect.width - offsetX;
    }
    
    // Check if popup would go off the bottom edge
    if (top + popupRect.height > viewportHeight) {
        top = y - popupRect.height - offsetY;
    }
    
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
}

