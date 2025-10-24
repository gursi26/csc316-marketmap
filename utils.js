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

