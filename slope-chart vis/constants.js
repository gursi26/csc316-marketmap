const SLOPE_CHART_CONSTANTS = {
    leftMargin: 300,
    rightMargin: 300,
    topMargin: 80,
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
    bubbleConnectorGap: 20,  // Gap between vertical line and bubble edge
    bubbleMinSpacing: 5,  // Minimum vertical spacing between bubbles
    tooltipStackedBarWidth: 200,  // Width of stacked bar in tooltip
    tooltipIconSize: 14,  // Size of icons in tooltip stacked bar
    instructionalTextFontSize: 15,  // Font size for instructional text at bottom
    instructionalTextLineSpacing: 23,  // Spacing between instructional text lines
    // Main chart title
    chartMainTitle: "Pay progression slope chart",
    chartMainTitleFontSize: 26,  // Font size for main title
    chartSubtitleFontSize: 18,  // Font size for subtitle (company/role name)
    chartTitleSpacing: 27,  // Spacing between main title and subtitle
    // Instructional text for company view (showing roles on left)
    instructionalTextLine1Company: "Click a role to see ranks",
    instructionalTextLine2Company: "Double-click a role to see breakdown by company",
    // Instructional text for role view (showing companies on left)
    instructionalTextLine1Role: "Click a company to see ranks",
    instructionalTextLine2Role: "Double-click a company to see breakdown by role"
};

const ANIMATION_DURATION = 800;
