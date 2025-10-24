// Utility functions for the compensation visualization

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
    const displayName = role.displayName ? role.displayName : formatRoleName(role.name);
    
    const html = `
        <div class="tooltip-title">${displayName}</div>
        <div class="tooltip-row">
            <span class="label">Avg Pay:</span>
            <span class="value">${formatCurrency(total)}</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Avg Base:</span>
            <span class="value">${formatCurrency(role.avgBase)}</span>
            <span class="percentage">(${((role.avgBase / total) * 100).toFixed(1)}%)</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Avg Stock:</span>
            <span class="value">${formatCurrency(role.avgStock)}</span>
            <span class="percentage">(${((role.avgStock / total) * 100).toFixed(1)}%)</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Avg Bonus:</span>
            <span class="value">${formatCurrency(role.avgBonus)}</span>
            <span class="percentage">(${((role.avgBonus / total) * 100).toFixed(1)}%)</span>
        </div>
    `;
    
    tooltip.innerHTML = html;
    tooltip.style.left = `${x + 15}px`;
    tooltip.style.top = `${y + 15}px`;
    tooltip.classList.add('visible');
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
    
    // Determine the title based on which property exists
    // In company view: rank.roleName exists (show role name)
    // In role view: rank.companyDisplayName exists (show full company name)
    const title = rank.roleName ? formatRoleName(rank.roleName) : (rank.companyDisplayName || rank.companyName);
    
    const html = `
        <div class="tooltip-title">${title}</div>
        <div class="tooltip-subtitle">${rank.rankName}</div>
        <div class="tooltip-row">
            <span class="label">Total Pay:</span>
            <span class="value">${formatCurrency(total)}</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Base Pay:</span>
            <span class="value">${formatCurrency(rank.basePay)}</span>
            <span class="percentage">(${((rank.basePay / total) * 100).toFixed(1)}%)</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Stock:</span>
            <span class="value">${formatCurrency(rank.stock)}</span>
            <span class="percentage">(${((rank.stock / total) * 100).toFixed(1)}%)</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Bonus:</span>
            <span class="value">${formatCurrency(rank.bonus)}</span>
            <span class="percentage">(${((rank.bonus / total) * 100).toFixed(1)}%)</span>
        </div>
    `;
    
    tooltip.innerHTML = html;
    tooltip.style.left = `${x + 15}px`;
    tooltip.style.top = `${y + 15}px`;
    tooltip.classList.add('visible');
}

/**
 * Updates tooltip position
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function updateTooltipPosition(x, y) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.left = `${x + 15}px`;
    tooltip.style.top = `${y + 15}px`;
}

