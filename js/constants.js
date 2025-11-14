const SLOPE_CHART_CONSTANTS = {
    leftMargin: 300,
    rightMargin: 300,
    topMargin: 110,
    bottomMargin: 120,
    lineGap: 400,
    dotRadius: 6,
    labelOffset: 15,
    fontSize: 12,
    titleFontSize: 16,
    lineColor: "#888",
    lineOpacity: 0.5,
    lineWidth: 1.5,
    roleColor: "#4A90E2",
    rankColor: "#E94B3C",
    distributionBuckets: 15,  // Number of buckets for stacked bar chart distribution
    bubbleHeight: 18,  // Height of role and rank bubbles (should be >= fontSize + 2*verticalPadding)
    bubblePadding: 7,  // Horizontal padding inside bubbles (left/right)
    bubbleVerticalPadding: 7,  // Vertical padding inside bubbles (top/bottom)
    bubbleFontSize: 12,  // Font size for bubble text
    bubbleConnectorGap: 35,  // Gap between vertical line and bubble edge
    bubbleMinSpacing: 5,  // Minimum vertical spacing between bubbles
    // Logo bubble settings (for company logos in role view)
    logoBubbleSize: 40,  // Size of square bubble containing logo
    logoSize: 32,  // Size of logo image inside bubble
    logoPadding: 4,  // Padding around logo inside bubble
    tooltipStackedBarWidth: 200,  // Width of stacked bar in tooltip
    tooltipIconSize: 14,  // Size of icons in tooltip stacked bar
    instructionalTextFontSize: 15,  // Font size for instructional text at bottom
    instructionalTextLineSpacing: 23,  // Spacing between instructional text lines
    // Y-axis text styling
    yAxisFontSize: 16,  // Font size for y-axis labels ($100k, $1M, etc.)
    yAxisOpacity: 0.5,  // Opacity for y-axis text (0.0 to 1.0)
    yAxisFontWeight: 'normal',  // Font weight for y-axis text ('normal', 'bold', etc.)
    // Main chart title
    chartMainTitle: "Pay progression slope chart",
    chartMainTitleFontSize: 26,  // Font size for main title
    chartSubtitleFontSize: 18,  // Font size for subtitle (company/role name)
    chartTitleSpacing: 27,  // Spacing between main title and subtitle
    infoIconRadius: 10,  // Radius of the info icon circle
    infoIconOffset: 25,  // Horizontal offset from title text
    infoPopupText: "Visualizes pay progression across career ranks.\n\n• Select by Company: See top 10 roles in a given company and how pay scales at each rank.\n• Select by Role: See top 10 highest paying companies for a given role and how pay scales at each rank.\n\nLeft line: Roles/companies by average compensation\nRight line: Individual rank levels (L1, L2, etc.)\n\nClick to highlight ranks • Double-click to switch views",  // Info popup text
    // Dropdown controls styling
    dropdownWidth: 140,  // Width of dropdown selects (px)
    dropdownHeight: 32,  // Height of dropdown selects (px)
    dropdownLabelFontSize: 15,  // Font size for dropdown labels
    // Instructional text for company view (showing roles on left)
    instructionalTextLine1Company: "Click a role to see ranks, double-click to see breakdown by company",
    // Instructional text for role view (showing companies on left)
    instructionalTextLine1Role: "Click a company to see ranks, double-click to see breakdown by role",
};

const ANIMATION_DURATION = 800;
