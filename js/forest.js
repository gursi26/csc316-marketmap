// ============================================================
// CONFIG & CONSTANTS
// ============================================================

const FIN_DATA_PATH = "dataset/cleaned/Company-financials-sentiment-weekly-snapshot.csv";
const INFO_PATH = "dataset/cleaned/Company-info.csv";
const LOGO_PATH = "dataset/logos/images/"; // + TICKER.png

const START_YEAR = 2022;
const END_YEAR = 2025;

// layout
const forestSvg = d3.select("#forest-viz");
const forestMargin = { top: 40, right: 80, bottom: 110, left: 80 };
const forestWidth = parseInt(forestSvg.style("width")) || 1200;
const forestHeight = parseInt(forestSvg.style("height")) || 700;

forestSvg.attr("viewBox", `0 0 ${forestWidth} ${forestHeight}`);

const gRoot = forestSvg.append("g")
    .attr("class", "forest-root")
    .attr("transform", `translate(${forestMargin.left},${forestMargin.top})`);

const innerWidth = forestWidth - forestMargin.left - forestMargin.right;
const innerHeight = forestHeight - forestMargin.top - forestMargin.bottom + 20;

// trunk & branch scaling (editable)
const TRUNK_MIN_WIDTH = 10;
const TRUNK_MAX_WIDTH = 40;

const BRANCH_MIN_LENGTH = 40;   // editable

const BRANCH_MAX_LENGTH = 160;  // editable

// leaves
const LEAF_WIDTH = 48;          // overall leaf length (editable)
const LEAF_HEIGHT = 22;          // leaf thickness (editable)
const LEAF_ANGLE_DEG = 15;     // mostly vertical, slight slant
const LEAF_VOLUME_DIVISOR = 7.5e6; // base used in leaf-count mapping (editable)
const LEAF_MIN_COUNT = 3;
const LEAF_MAX_COUNT = 40;

// stock split X
const SPLIT_ANGLE_DEG = 0;     // very flat X
const SPLIT_OFFSET_Y = 12;      // vertical span of X arms

// colours
const TRUNK_COLOR = "#99612f";
const TRUNK_GRAIN_COLOR = "#3b2413";

const BRANCH_COLOR = "#633b1aff";

// globals
let companyInfo = null;
let financials = null;
let nameByTicker = {};
let quarterDomain = [];
let isAnimating = false;
let globalSentimentExtent = [-1, 1];

// simple tooltip
const forestTooltip = d3.select("body")
    .append("div")
    .attr("id", "forest-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "rgba(6, 10, 25, 0.96)")
    .style("padding", "8px 10px")
    .style("border-radius", "6px")
    .style("font-family", "system-ui, -apple-system, BlinkMacSystemFont, 'Work Sans', sans-serif")
    .style("font-size", "12px")
    .style("color", "#e5e7eb")
    .style("box-shadow", "0 8px 20px rgba(0, 0, 0, 0.45)")
    .style("opacity", 0);

// ============================================================
// QUARTER HELPERS
// ============================================================

function buildQuarterDomain() {
    const qs = [];
    for (let year = START_YEAR; year <= END_YEAR; year++) {
        for (let q = 1; q <= 4; q++) {
            qs.push(`${year}-Q${q}`);
        }
    }
    return qs;
}
quarterDomain = buildQuarterDomain();

function dateToQuarter(dateStr) {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${year}-Q${q}`;
}

// compute leaf count from avg volume (uses sqrt to compress NVDA, etc.)
function computeLeafCount(avgVolume) {
    if (!avgVolume || avgVolume <= 0) return 0;

    // LOG SCALE — compresses NVDA volume massively
    const scaled = Math.log10(avgVolume + 1); // 7–9 range for most stocks

    let count = Math.round(
        d3.scaleLinear()
            .domain([6, 9.5])        // adjust these if needed
            .range([LEAF_MIN_COUNT, LEAF_MAX_COUNT])
            (scaled)
    );

    return Math.max(LEAF_MIN_COUNT, Math.min(LEAF_MAX_COUNT, count));
}


// ============================================================
// LOAD DATA
// ============================================================

Promise.all([
    d3.csv(INFO_PATH),
    d3.csv(FIN_DATA_PATH)
]).then(([info, fin]) => {
    companyInfo = info;
    financials = fin;

    nameByTicker = {};
    companyInfo.forEach(d => {
        nameByTicker[d.Ticker] = d.Name;
    });

    // compute global sentiment extent for colouring
    // ============================================================
    // GLOBAL quarterly sentiment extent (ALL COMPANIES)
    // ============================================================

    let allQuarterlySent = [];

    // Build quarterly data for *every* ticker
    companyInfo.forEach(c => {
        const quarters = buildQuarterDataForTicker(c.Ticker);
        quarters.forEach(q => {
            if (q.avgSentiment != null && !isNaN(q.avgSentiment)) {
                allQuarterlySent.push(q.avgSentiment);
            }
        });
    });

    if (allQuarterlySent.length > 0) {
        globalSentimentExtent = d3.extent(allQuarterlySent);
    }


    setupForestControls();
    drawInitial();
}).catch(err => {
    console.error("Error loading forest data:", err);
});

// ============================================================
// CONTROLS
// ============================================================

function setupForestControls() {
    const selectIds = ["forest-company-1", "forest-company-2", "forest-company-3"];

    selectIds.forEach(id => {
        const sel = d3.select("#" + id);
        companyInfo.forEach(d => {
            sel.append("option")
                .attr("value", d.Ticker)
                .text(d.Name);
        });
    });

    // defaults
    if (companyInfo.length >= 3) {
        d3.select("#forest-company-1").property("value", "AVGO");
        d3.select("#forest-company-2").property("value", "AAPL");
        d3.select("#forest-company-3").property("value", "MSFT");
    }

    selectIds.forEach(id => {
        d3.select("#" + id).on("change", () => {
            if (!isAnimating) {
                drawTrees(false);
            }
        });
    });

    d3.select("#forest-play").on("click", () => {
        if (!isAnimating) {
            animateGrowth();
        }
    });

    d3.select("#forest-reset").on("click", () => {
        if (!isAnimating) {
            drawTrees(false);
        }
    });
}

function drawInitial() {
    if (!financials || !companyInfo) {
        return;
    }
    drawTrees(false);
}

// ============================================================
// BUILD QUARTER DATA FOR ONE TICKER
// ============================================================

function buildQuarterDataForTicker(ticker) {
    const rows = financials.filter(d => d.Ticker === ticker);
    const grouped = d3.group(rows, d => dateToQuarter(d.Date));

    const quarterData = quarterDomain.map(q => {
        const vals = grouped.get(q) || [];
        if (vals.length === 0) {
            return {
                quarter: q,
                hasData: false,
                avgClose: null,
                avgMarketCap: null,
                avgVolume: null,
                avgSentiment: 0,
                stockSplits: 0
            };
        } else {
            return {
                quarter: q,
                hasData: true,
                avgClose: d3.mean(vals, d => +d.Close),
                avgMarketCap: d3.mean(vals, d => +d["Market Cap"]),
                avgVolume: d3.mean(vals, d => +d.Volume),
                avgSentiment: d3.mean(vals, d => +d.sentiment_score),
                stockSplits: d3.sum(vals, d => +d["Stock Splits"])
            };
        }
    });

    // Normalization: find 2022 Q1 close for this ticker
    const base = quarterData.find(q => q.quarter === "2022-Q1" && q.avgClose != null)?.avgClose || null;

    // Normalize prices relative to Q1 2022
    quarterData.forEach(q => {
        if (base && q.avgClose != null) {
            q.normClose = q.avgClose / base;    // relative change
        } else {
            q.normClose = null;
        }
    });


    return quarterData;
}

// ============================================================
// DRAW FOREST
// ============================================================

function drawTrees(animated) {
    gRoot.selectAll("*").remove();

    const tickers = [
        d3.select("#forest-company-1").property("value"),
        d3.select("#forest-company-2").property("value"),
        d3.select("#forest-company-3").property("value")
    ];

    const trees = tickers.map((ticker, idx) => {
        return {
            ticker,
            name: nameByTicker[ticker] || ticker,
            quarters: buildQuarterDataForTicker(ticker),
            x: innerWidth * ((idx + 1) / 4) - innerWidth * 0.12
        };
    });

    // collect ranges for scales
    const allCaps = trees.flatMap(t =>
        t.quarters.map(q => q.avgMarketCap).filter(v => v != null && !isNaN(v))
    );
    const allClose = trees.flatMap(t =>
        t.quarters.map(q => q.normClose)
            .filter(v => v != null && !isNaN(v))
    );


    // bail out if we have no valid financials at all
    if (!allCaps.length || !allClose.length) {
        return;
    }

    const capExtent = d3.extent(allCaps);
    const priceExtent = d3.extent(allClose);

    const yScale = d3.scaleBand()
        .domain(quarterDomain)
        .range([innerHeight, 0])
        .padding(0.12);

    const trunkScale = d3.scaleLinear()
        .domain(capExtent)
        .range([TRUNK_MIN_WIDTH, TRUNK_MAX_WIDTH]);

    const branchScale = d3.scaleLinear()
        .domain(priceExtent)
        .range([BRANCH_MIN_LENGTH, BRANCH_MAX_LENGTH]);

    const sentimentScale = d3.scaleDiverging()
        .domain([globalSentimentExtent[0], 0, globalSentimentExtent[1]])
        .interpolator(d3.interpolateRdYlGn);

    // approximate "volume per leaf" for legend
    const volumePerLeafSamples = [];
    trees.forEach(tree => {
        tree.quarters.forEach(q => {
            if (q.avgVolume && q.avgVolume > 0) {
                const c = computeLeafCount(q.avgVolume);
                if (c > 0) {
                    volumePerLeafSamples.push(q.avgVolume / c);
                }
            }
        });
    });
    let approxVolumePerLeaf = LEAF_VOLUME_DIVISOR;
    if (volumePerLeafSamples.length > 0) {
        approxVolumePerLeaf = d3.median(volumePerLeafSamples);
    }

    // ========================================================
    // GRID LINES & QUARTER LABELS
    // ========================================================

    // background quarter grid
    const gridG = gRoot.append("g")
        .attr("class", "quarter-grid");

    gridG.selectAll("line")
        .data(quarterDomain)
        .join("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", "#151827")
        .attr("stroke-width", 0.8)
        .attr("stroke-dasharray", "2,3");

    // axis title
    gRoot.append("text")
        .attr("class", "forest-axis-label")
        .attr("x", -70)
        .attr("y", -18)
        .attr("fill", "#d1d5db")
        .attr("font-size", 11)
        .text("Year (quarters)");

    // quarter labels on left
    const axisG = gRoot.append("g")
        .attr("transform", "translate(-20,0)");

    axisG.selectAll("text.quarter-label")
        .data(quarterDomain)
        .join("text")
        .attr("class", "forest-axis-label")
        .attr("x", 0)
        .attr("y", d => yScale(d) + yScale.bandwidth() / 2 + 3)
        .attr("text-anchor", "end")
        .attr("fill", "#9ca3af")
        .attr("font-size", 10)
        .text(d => d.replace("-", " ")); // "2022-Q1" -> "2022 Q1"

    // ========================================================
    // TREES
    // ========================================================

    const treesG = gRoot.append("g").attr("class", "trees-group");

    trees.forEach((tree, idx) => {
        drawSingleTree(
            treesG,
            tree,
            yScale,
            trunkScale,
            branchScale,
            sentimentScale,
            idx,
            animated,
            approxVolumePerLeaf
        );
    });

    // ========================================================
    // LEGEND (top-right)
    // ========================================================

    drawLegend(
        capExtent,
        priceExtent,
        trunkScale,
        branchScale,
        sentimentScale,
        approxVolumePerLeaf
    );

    // ========================================================
    // REALISTIC GRASS
    // ========================================================
    const grassY = innerHeight + 15;
    const grassGroup = gRoot.append("g").attr("class", "grass-group");

    const numBlades = 300; // more = denser
    for (let i = 0; i < numBlades; i++) {
        const x = (innerWidth / numBlades) * i;
        const h = 10 + Math.random() * 18;       // varying height
        const slant = (Math.random() - 0.5) * 6; // slight leaning

        grassGroup.append("line")
            .attr("x1", x + 5)
            .attr("y1", grassY + 10)
            .attr("x2", x + slant)
            .attr("y2", grassY - h + 10)
            .attr("stroke", "#2e7d32")
            .attr("stroke-width", 2 + Math.random() * 0.8)
            .attr("stroke-linecap", "round")
            .attr("opacity", 0.9);
    }


    // ========================================================
    // LOGOS UNDER TREES
    // ========================================================

    const logoY = innerHeight + 53;

    const logosG = gRoot.append("g").attr("class", "logos-group");
    trees.forEach(tree => {
        const logoGroup = logosG.append("g")
            .attr("transform", `translate(${tree.x}, ${logoY})`);

        logoGroup.append("image")
            .attr("href", `${LOGO_PATH}${tree.ticker}.png`)
            .attr("x", -24)
            .attr("y", -24)
            .attr("width", 48)
            .attr("height", 48);

        logoGroup.append("text")
            .attr("y", 36) // a bit lower so it does not touch the logo
            .attr("text-anchor", "middle")
            .attr("fill", "#9ca3af")
            .attr("font-size", 11)
            .text(tree.ticker);
    });
}

// ============================================================
// DRAW SINGLE TREE
// ============================================================

function drawSingleTree(
    parentG,
    tree,
    yScale,
    trunkScale,
    branchScale,
    sentimentScale,
    treeIndex,
    animated,
    approxVolumePerLeaf
) {
    const g = parentG.append("g")
        .attr("class", "tree")
        .attr("transform", `translate(${tree.x},0)`);

    // label above tree (shifted up to avoid overlap)
    g.append("text")
        .attr("x", 0)
        .attr("y", -22)
        .attr("fill", "#e5e7eb")
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .text(tree.name);

    const epsilon = 1e-4;

    const quartersG = g.append("g").attr("class", "quarters");

    const quarterGroups = quartersG.selectAll("g.q")
        .data(tree.quarters)
        .join("g")
        .attr("class", "q")
        .attr("data-quarter-index", (d, i) => i)
        .attr("transform", d => {
            const y = yScale(d.quarter) + yScale.bandwidth() / 2;
            return `translate(0,${y})`;
        });



    // --------------------------------------------------------
    // branches
    // --------------------------------------------------------

    // horizontal branches for non-split quarters
    const nonSplit = quarterGroups.filter(d => !d.stockSplits || d.stockSplits <= 0);

    nonSplit.append("line")
        .attr("class", "branch branch-left")
        .attr("x1", 0)
        .attr("x2", d => {
            if (!d.hasData || d.normClose == null) {
                return -BRANCH_MIN_LENGTH;
            }
            return -branchScale(d.normClose);
        })
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", BRANCH_COLOR)
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 7)
        .attr("opacity", animated ? 0 : 1);

    nonSplit.append("line")
        .attr("class", "branch branch-right")
        .attr("x1", 0)
        .attr("x2", d => {
            if (!d.hasData || d.normClose == null) {
                return BRANCH_MIN_LENGTH;
            }
            return branchScale(d.normClose);
        })
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", BRANCH_COLOR)
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 7)
        .attr("opacity", animated ? 0 : 1);

    // X-shaped split branches for quarters with stock splits
    const split = quarterGroups.filter(d => d.stockSplits && d.stockSplits > 0);

    split.each(function (d) {
        const gQ = d3.select(this);
        const len = (!d.hasData || d.normClose == null)
            ? BRANCH_MIN_LENGTH
            : branchScale(d.normClose);

        const angleRad = (SPLIT_ANGLE_DEG * Math.PI) / 180;

        // Up-right, down-right, up-left, down-left
        const arms = [
            { sx: 0, sy: 0, dx: len * Math.cos(angleRad), dy: -SPLIT_OFFSET_Y },
            { sx: 0, sy: 0, dx: len * Math.cos(angleRad), dy: SPLIT_OFFSET_Y },
            { sx: 0, sy: 0, dx: -len * Math.cos(angleRad), dy: -SPLIT_OFFSET_Y },
            { sx: 0, sy: 0, dx: -len * Math.cos(angleRad), dy: SPLIT_OFFSET_Y }
        ];

        arms.forEach(arm => {
            gQ.append("line")
                .attr("class", "branch split-branch")
                .attr("x1", arm.sx)
                .attr("y1", arm.sy)
                .attr("x2", arm.dx)
                .attr("y2", arm.dy)
                .attr("stroke", BRANCH_COLOR)
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 7)
                .attr("opacity", animated ? 0 : 1);
        });
    });

    // trunk segments
    quarterGroups.append("line")
        .attr("class", "trunk-segment")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", -yScale.bandwidth() * 0.45)
        .attr("y2", yScale.bandwidth() * 0.45)
        .attr("stroke", TRUNK_COLOR)
        .attr("stroke-linecap", "round")
        .attr("stroke-width", d => {
            if (!d.hasData || d.avgMarketCap == null) {
                return TRUNK_MIN_WIDTH;
            }
            return trunkScale(d.avgMarketCap);
        })
        .attr("opacity", animated ? 0 : 1);

    // --------------------------------------------------------
    // leaves
    // --------------------------------------------------------

    quarterGroups.each(function (d) {
        const gQ = d3.select(this);
        if (!d.hasData || d.avgVolume == null) {
            return;
        }

        const hasSplit = d.stockSplits && d.stockSplits > 0;
        const baseLen = (!d.hasData || d.normClose == null)
            ? BRANCH_MIN_LENGTH
            : branchScale(d.normClose);

        let leafCount = computeLeafCount(d.avgVolume);
        if (leafCount <= 0) {
            return;
        }

        const sentiment = d.avgSentiment || 0;
        const leafFill = (Math.abs(sentiment) < epsilon)
            ? "#9ca3af"
            : sentimentScale(sentiment);

        // placements depend on split vs non-split
        let attachmentBranches;
        if (hasSplit) {
            // four arms of X
            attachmentBranches = [
                { side: 1, verticalSign: -1 },
                { side: 1, verticalSign: 1 },
                { side: -1, verticalSign: -1 },
                { side: -1, verticalSign: 1 }
            ];
        } else {
            // simple left/right, slightly above and below
            attachmentBranches = [
                { side: 1, verticalSign: -0.45 },
                { side: 1, verticalSign: 0.45 },
                { side: -1, verticalSign: -0.45 },
                { side: -1, verticalSign: 0.45 }
            ];
        }

        const groups = attachmentBranches.length;
        const leavesPerGroup = Math.ceil(leafCount / groups);

        const angleLeafRad = (LEAF_ANGLE_DEG * Math.PI) / 180;

        for (let i = 0; i < leafCount; i++) {
            const groupIndex = i % groups;
            const stepIndex = Math.floor(i / groups);

            const t = (stepIndex + 1) / (leavesPerGroup + 1);

            const branch = attachmentBranches[groupIndex];

            const branchHalfWidth = 7 / 2;
            const rawX = baseLen * t;

            // push leaves out to at least ~2× the branch half-width
            const minLeafOffset = branchHalfWidth * 7;   // tweak 2.2 as you like
            const xBase = branch.side * Math.max(rawX, minLeafOffset);


            const yBase = hasSplit
                ? branch.verticalSign * SPLIT_OFFSET_Y * t
                : branch.verticalSign * 24; // small vertical offset above/below branch

            // leaf group (stem + body)
            const leafG = gQ.append("g")
                .attr("class", "leaf")
                .attr("transform", `translate(${xBase},${yBase}) rotate(${branch.side > 0 ? LEAF_ANGLE_DEG : -LEAF_ANGLE_DEG})`)
                .attr("opacity", animated ? 0 : 0.9);



            // leaf body -> pointed oval (diamond-like but rounded via path)
            const halfW = LEAF_WIDTH / 2;
            const halfH = LEAF_HEIGHT / 2;

            const pathD = [
                `M 0 ${-halfH}`,                 // top point
                `Q ${halfW * 0.6} 0 0 ${halfH}`, // right curve
                `Q ${-halfW * 0.6} 0 0 ${-halfH}`, // left curve back to top
                "Z"
            ].join(" ");

            leafG.append("path")
                .attr("d", pathD)
                .attr("fill", leafFill)
                .attr("stroke", "#111827")
                .attr("stroke-width", 0.7);

            // centre vein
            leafG.append("line")
                .attr("x1", 0)
                .attr("y1", -halfH + 0.3)
                .attr("x2", 0)
                .attr("y2", halfH - 0.3)
                .attr("stroke", "#e5e7eb")
                .attr("stroke-width", 0.7)
                .attr("stroke-linecap", "round");
        }
    });

    // --------------------------------------------------------
    // HOVER TOOLTIP (per quarter group)
    // --------------------------------------------------------

    quarterGroups
        .on("mouseenter", function (event, d) {
            const [x, y] = d3.pointer(event, forestSvg.node());

            const html = buildQuarterTooltipHtml(tree, d, approxVolumePerLeaf);
            forestTooltip
                .html(html)
                .style("left", `${x + 18}px`)
                .style("top", `${y + 18}px`)
                .transition()
                .duration(120)
                .style("opacity", 1);
        })
        .on("mousemove", function (event) {
            const [x, y] = d3.pointer(event, forestSvg.node());
            forestTooltip
                .style("left", `${x + 18}px`)
                .style("top", `${y + 18}px`);
        })
        .on("mouseleave", function () {
            forestTooltip
                .transition()
                .duration(120)
                .style("opacity", 0);
        });
}

// ============================================================
// LEGEND
// ============================================================

function drawLegend(
    capExtent,
    priceExtent,
    trunkScale,
    branchScale,
    sentimentScale,
    approxVolumePerLeaf
) {
    const legendG = gRoot.append("g")
        .attr("class", "forest-legend")
        .attr("transform", `translate(${innerWidth - 360}, 10)`);

    legendG.append("text")
        .attr("x", 90)
        .attr("y", 0)
        .attr("fill", "#e5e7eb")
        .attr("font-weight", "600")
        .attr("font-size", 12)
        .text("Legend");

    // sample values (midpoints)
    const midCap = (capExtent[0] + capExtent[1]) / 2;
    const midPrice = (priceExtent[0] + priceExtent[1]) / 2;
    const trunkSampleWidth = trunkScale(midCap);
    const branchSampleLen = branchScale(midPrice);

    // trunk sample (vertical)
    const trunkY = 50;
    const trunkX = 100;

    legendG.append("line")
        .attr("x1", trunkX)
        .attr("x2", trunkX)
        .attr("y1", trunkY - 18)
        .attr("y2", trunkY + 18)
        .attr("stroke", TRUNK_COLOR)
        .attr("stroke-linecap", "round")
        .attr("stroke-width", trunkSampleWidth);

    legendG.append("text")
        .attr("x", trunkX + 36)
        .attr("y", trunkY - 4)
        .attr("fill", "#e5e7eb")
        .attr("font-size", 11)
        .text("Trunk width = market cap");

    legendG.append("text")
        .attr("x", trunkX + 36)
        .attr("y", trunkY + 12)
        .attr("fill", "#9ca3af")
        .attr("font-size", 10)
        .text(`≈ $${(midCap / 1e9).toFixed(1)}B market capitalization`);

    // branch sample (horizontal)
    const branchY = trunkY + 60;

    legendG.append("line")
        .attr("x1", trunkX - branchSampleLen / 2 + 40)
        .attr("x2", trunkX + branchSampleLen / 2 - 20)
        .attr("y1", branchY)
        .attr("y2", branchY)
        .attr("stroke", BRANCH_COLOR)
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 7);

    legendG.append("text")
        .attr("x", trunkX + branchSampleLen / 2 + 10)
        .attr("y", branchY - 4)
        .attr("fill", "#e5e7eb")
        .attr("font-size", 12)
        .text("Branch length = stock price");

    legendG.append("text")
        .attr("x", trunkX + branchSampleLen / 2 + 10)
        .attr("y", branchY + 12)
        .attr("fill", "#9ca3af")
        .attr("font-size", 11)
        .text("length is relative to 2022 Q1 (normalized)");

    // sentiment gradient
    const gradY = branchY + 32;
    const gradWidth = 130;
    const gradHeight = 10;

    const defs = forestSvg.select("defs").empty()
        ? forestSvg.append("defs")
        : forestSvg.select("defs");

    const gradientId = "forest-sentiment-gradient";

    let gradient = defs.select("#" + gradientId);
    if (gradient.empty()) {
        gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");
    }
    gradient.selectAll("stop").remove();

    const stops = 16;
    for (let i = 0; i <= stops; i++) {
        const t = i / stops;
        const val = globalSentimentExtent[0] +
            t * (globalSentimentExtent[1] - globalSentimentExtent[0]);
        gradient.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", sentimentScale(val));
    }

    legendG.append("rect")
        .attr("x", trunkX - 10)
        .attr("y", gradY)
        .attr("width", gradWidth)
        .attr("height", gradHeight)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", `url(#${gradientId})`)
        .attr("stroke", "#111827")
        .attr("stroke-width", 0.8);

    legendG.append("text")
        .attr("x", trunkX + gradWidth + 10)
        .attr("y", gradY + gradHeight - 2)
        .attr("fill", "#e5e7eb")
        .attr("font-size", 11)
        .text("Sentiment score");

    legendG.append("text")
        .attr("x", trunkX - 10)
        .attr("y", gradY + gradHeight + 13)
        .attr("fill", "#9ca3af")
        .attr("font-size", 9)
        .text(globalSentimentExtent[0].toFixed(2));

    legendG.append("text")
        .attr("x", trunkX + gradWidth / 2 - 10)
        .attr("y", gradY + gradHeight + 13)
        .attr("fill", "#9ca3af")
        .attr("font-size", 9)
        .attr("text-anchor", "middle")
        .text("0");

    legendG.append("text")
        .attr("x", trunkX + gradWidth - 10)
        .attr("y", gradY + gradHeight + 13)
        .attr("fill", "#9ca3af")
        .attr("font-size", 9)
        .attr("text-anchor", "end")
        .text(globalSentimentExtent[1].toFixed(2));

    // leaf legend
    const leafLegendY = gradY + gradHeight + 40;
    const leafSampleGroup = legendG.append("g")
        .attr("transform", `translate(${trunkX}, ${leafLegendY})`);

    const sampleColor = sentimentScale(0);

    // three sample leaves
    for (let i = 0; i < 1; i++) {
        const offsetX = i * (LEAF_WIDTH + 4);

        const leafG = leafSampleGroup.append("g")
            .attr("transform", `translate(${offsetX},0)`);

        const halfW = LEAF_WIDTH / 2;
        const halfH = LEAF_HEIGHT / 2;

        const pathD = [
            `M 0 ${-halfH}`,
            `Q ${halfW * 0.6} 0 0 ${halfH}`,
            `Q ${-halfW * 0.6} 0 0 ${-halfH}`,
            "Z"
        ].join(" ");

        leafG.append("path")
            .attr("d", pathD)
            .attr("fill", sampleColor)
            .attr("stroke", "#111827")
            .attr("stroke-width", 0.7);

        leafG.append("line")
            .attr("x1", 0)
            .attr("y1", -halfH + 0.3)
            .attr("x2", 0)
            .attr("y2", halfH - 0.3)
            .attr("stroke", "#e5e7eb")
            .attr("stroke-width", 0.7)
            .attr("stroke-linecap", "round");
    }

    const volText = `Leaves ≈ trading volume (≈ ${(approxVolumePerLeaf / 1e6).toFixed(1)}M shares / leaf)`;

    legendG.append("text")
        .attr("x", trunkX + 10 + LEAF_WIDTH * 1 - 20)
        .attr("y", leafLegendY + 4)
        .attr("fill", "#e5e7eb")
        .attr("font-size", 11)
        .text(volText);

    // --------------------------------------------------------
    // STOCK SPLIT LEGEND (X-shaped branch)
    // --------------------------------------------------------
    const splitLegendY = leafLegendY + 40;
    const xLen = 20;
    const angle = SPLIT_ANGLE_DEG * Math.PI / 180;

    const splitG = legendG.append("g")
        .attr("transform", `translate(${trunkX}, ${splitLegendY})`);

    [
        { dx: xLen * Math.cos(angle), dy: -SPLIT_OFFSET_Y },
        { dx: xLen * Math.cos(angle), dy: SPLIT_OFFSET_Y },
        { dx: -xLen * Math.cos(angle), dy: -SPLIT_OFFSET_Y },
        { dx: -xLen * Math.cos(angle), dy: SPLIT_OFFSET_Y },
    ].forEach(arm => {
        splitG.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", arm.dx)
            .attr("y2", arm.dy)
            .attr("stroke", BRANCH_COLOR)
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 7);
    });

    legendG.append("text")
        .attr("x", trunkX + 40)
        .attr("y", splitLegendY + 4)
        .attr("fill", "#e5e7eb")
        .attr("font-size", 11)
        .text("Stock split (X-shaped branches)");

}

// ============================================================
// TOOLTIP CONTENT
// ============================================================

function buildQuarterTooltipHtml(tree, quarter, approxVolumePerLeaf) {
    const qLabel = quarter.quarter.replace("-", " ");
    const mc = quarter.avgMarketCap;
    const close = quarter.avgClose;
    const vol = quarter.avgVolume;
    const sent = quarter.avgSentiment;
    const splits = quarter.stockSplits || 0;

    const parts = [];
    parts.push(`<div style="font-weight:600;margin-bottom:4px;">${tree.name} — ${qLabel}</div>`);

    if (!quarter.hasData) {
        parts.push(`<div style="color:#9ca3af;">No data for this quarter.</div>`);
        return parts.join("");
    }

    if (mc != null && !isNaN(mc)) {
        parts.push(`<div>Market cap: <span style="color:#bfdbfe;">$${(mc / 1e9).toFixed(1)}B</span></div>`);
    }
    if (close != null && !isNaN(close)) {
        parts.push(`<div>Avg close price: <span style="color:#bfdbfe;">$${close.toFixed(2)}</span></div>`);
    }
    if (vol != null && !isNaN(vol)) {
        const estLeaves = computeLeafCount(vol);
        const perLeaf = estLeaves > 0 ? vol / estLeaves : approxVolumePerLeaf;
        parts.push(`<div>Avg volume: <span style="color:#bfdbfe;">${(vol / 1e6).toFixed(1)}M</span> shares</div>`);
        parts.push(`<div style="font-size:11px;color:#9ca3af;">≈ ${(perLeaf / 1e6).toFixed(1)}M shares / leaf</div>`);
    }
    if (sent != null && !isNaN(sent)) {
        parts.push(`<div>Sentiment score: <span style="color:#bbf7d0;">${sent.toFixed(2)}</span></div>`);
    }
    if (splits > 0) {
        parts.push(`<div>Stock splits: <span style="color:#fcd34d;">${splits}</span></div>`);
    }

    return parts.join("");
}

// ============================================================
// ANIMATION
// ============================================================

function animateGrowth() {
    if (isAnimating) {
        return;
    }
    isAnimating = true;

    // redraw with everything invisible
    drawTrees(true);

    const treeGroups = gRoot.selectAll("g.tree");
    const totalQuarters = quarterDomain.length;
    const stepDuration = 350;

    for (let qIndex = 0; qIndex < totalQuarters; qIndex++) {
        const delay = qIndex * stepDuration;

        treeGroups
            .selectAll(`g.q[data-quarter-index="${qIndex}"]`)
            .selectAll(".trunk-segment, .branch, .leaf")
            .transition()
            .delay(delay)
            .duration(stepDuration)
            .attr("opacity", function (d) {
                const isLeaf = d3.select(this).classed("leaf");
                if (!d || d.hasData === false) {
                    // faint trunk/branch for missing data, no leaves
                    return isLeaf ? 0 : 0.2;
                }
                return isLeaf ? 0.9 : 1;
            });
    }

    const totalDuration = totalQuarters * stepDuration + 300;
    setTimeout(() => {
        isAnimating = false;
    }, totalDuration);
}
