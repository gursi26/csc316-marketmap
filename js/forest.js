

// ---- CONFIG ----
const FIN_DATA_PATH = "../dataset/cleaned/Company-financials-sentiment-weekly-snapshot.csv";
const INFO_PATH = "../data/Company-info.csv";
// Use root-level logos directory (matching scatter usage)
const LOGO_PATH = "../dataset/logos/images/"; // + TICKER.png

const START_YEAR = 2022;
const END_YEAR = 2025;

const forestSvg = d3.select("#forest-viz");
const forestMargin = { top: 30, right: 80, bottom: 110, left: 80 };
const forestWidth = parseInt(forestSvg.style("width")) || 1200;
const forestHeight = parseInt(forestSvg.style("height")) || 700;

forestSvg.attr("viewBox", `0 0 ${forestWidth} ${forestHeight}`);

const gRoot = forestSvg.append("g")
  .attr("class", "forest-root")
  .attr("transform", `translate(${forestMargin.left},${forestMargin.top})`);

const innerWidth = forestWidth - forestMargin.left - forestMargin.right;
const innerHeight = forestHeight - forestMargin.top - forestMargin.bottom;

// globals
let companyInfo = null;
let financials = null;
let nameByTicker = {};
let quarterDomain = [];
let isAnimating = false;

// ---- BUILD QUARTER DOMAIN ----
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

// ---- LOAD DATA ----
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

  setupControls();
  drawInitial();
}).catch(err => {
  console.error("Error loading forest data:", err);
});

// ---- CONTROLS ----
function setupControls() {
  const selectIds = ["forest-company-1", "forest-company-2", "forest-company-3"];

  selectIds.forEach(id => {
    const sel = d3.select("#" + id);
    companyInfo.forEach(d => {
      sel.append("option")
        .attr("value", d.Ticker)
        .text(d.Name);
    });
  });

  // some defaults if present
  if (companyInfo.length >= 3) {
    d3.select("#forest-company-1").property("value", "NVDA");
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
  if (!financials || !companyInfo) return;
  drawTrees(false);
}

// ---- PROCESS ONE TICKER INTO QUARTERS ----
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

  return quarterData;
}

// ---- DRAW TREES (optionally animated) ----
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
      x: innerWidth * ((idx + 1) / 4) // 1/4, 2/4, 3/4 across width
    };
  });

  // collect ranges for scales
  const allCaps = trees.flatMap(t => t.quarters.map(q => q.avgMarketCap).filter(v => v != null));
  const allClose = trees.flatMap(t => t.quarters.map(q => q.avgClose).filter(v => v != null));
  const allSent = trees.flatMap(t => t.quarters.map(q => q.avgSentiment));

  const yScale = d3.scaleBand()
    .domain(quarterDomain)
    .range([innerHeight, 0])
    .padding(0.12);

  const trunkScale = d3.scaleLinear()
    .domain(d3.extent(allCaps))
    .range([10, 40]);

  const branchScale = d3.scaleLinear()
    .domain(d3.extent(allClose))
    .range([30, 130]);

  const sentimentScale = d3.scaleDiverging()
    .domain([-1, 0, 1])
    .interpolator(d3.interpolateRdYlGn);

  // Y-axis label (time)
  gRoot.append("text")
    .attr("class", "forest-axis-label")
    .attr("x", -50)
    .attr("y", -10)
    .text("2022 → 2025 (quarters)");

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
    .text(d => d.replace("-", " ")); // "2022-Q1" -> "2022 Q1"

  // draw each tree
  const treesG = gRoot.append("g").attr("class", "trees-group");

  trees.forEach((tree, idx) => {
    drawSingleTree(treesG, tree, yScale, trunkScale, branchScale, sentimentScale, idx, animated);
  });

  // logos under x axis
  const logoY = innerHeight + 50;

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
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("fill", "#9ca3af")
      .attr("font-size", 11)
      .text(tree.ticker);
  });
}

function drawSingleTree(parentG, tree, yScale, trunkScale, branchScale, sentimentScale, treeIndex, animated) {
  const g = parentG.append("g")
    .attr("class", "tree")
    .attr("transform", `translate(${tree.x},0)`);

  // tree label
  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "middle")
    .attr("font-size", 13)
    .text(tree.name);

  const trunkColor = "#8b5a2b";
  const maxLeavesPerBranch = 30;
  const volumeDivisor = 1e8; // tweak for leaf count scaling

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

  // trunk segments
  quarterGroups.append("line")
    .attr("class", "trunk-segment")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", -yScale.bandwidth() * 0.45)
    .attr("y2", yScale.bandwidth() * 0.45)
    .attr("stroke", trunkColor)
    .attr("stroke-linecap", "round")
    .attr("stroke-width", d => {
      if (!d.hasData || d.avgMarketCap == null) return 6;
      return trunkScale(d.avgMarketCap);
    })
    .attr("opacity", animated ? 0 : 1);

  // horizontal branches
  quarterGroups.append("line")
    .attr("class", "branch branch-left")
    .attr("x1", 0)
    .attr("x2", d => {
      if (!d.hasData || d.avgClose == null) return -40;
      return -branchScale(d.avgClose);
    })
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", trunkColor)
    .attr("stroke-linecap", "round")
    .attr("stroke-width", 7)
    .attr("opacity", animated ? 0 : 1);

  quarterGroups.append("line")
    .attr("class", "branch branch-right")
    .attr("x1", 0)
    .attr("x2", d => {
      if (!d.hasData || d.avgClose == null) return 40;
      return branchScale(d.avgClose);
    })
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", trunkColor)
    .attr("stroke-linecap", "round")
    .attr("stroke-width", 7)
    .attr("opacity", animated ? 0 : 1);

  // leaves
  quarterGroups.each(function (d) {
    const gQ = d3.select(this);
    if (!d.hasData || d.avgVolume == null) return;

    let leafCount = Math.round(d.avgVolume / volumeDivisor);
    leafCount = Math.max(2, Math.min(maxLeavesPerBranch, leafCount));

    const branchLen = d.avgClose == null ? 60 : branchScale(d.avgClose);
    const sentiment = d.avgSentiment || 0;
    const epsilon = 1e-4;
    const leafFill = Math.abs(sentiment) < epsilon ? "#6b7280" : sentimentScale(sentiment);

    for (let i = 0; i < leafCount; i++) {
      const t = (i + 1) / (leafCount + 1); // along branch
      const side = i % 2 === 0 ? 1 : -1;  // right vs left
      const xBase = side * branchLen * t;
      const offsetY = (i % 2 === 0 ? -10 : 10);

      gQ.append("circle")
        .attr("class", "leaf")
        .attr("cx", xBase)
        .attr("cy", offsetY)
        .attr("r", 5)
        .attr("fill", leafFill)
        .attr("opacity", animated ? 0 : 0.9);
    }

    // stock splits: V-shaped branches
    if (d.stockSplits && d.stockSplits > 0) {
      const vSize = 35;

      gQ.append("line")
        .attr("class", "split-branch")
        .attr("x1", 0).attr("y1", -yScale.bandwidth() * 0.45)
        .attr("x2", -vSize).attr("y2", -yScale.bandwidth() * 0.45 - vSize)
        .attr("stroke", trunkColor)
        .attr("stroke-width", 6)
        .attr("stroke-linecap", "round")
        .attr("opacity", animated ? 0 : 1);

      gQ.append("line")
        .attr("class", "split-branch")
        .attr("x1", 0).attr("y1", -yScale.bandwidth() * 0.45)
        .attr("x2", vSize).attr("y2", -yScale.bandwidth() * 0.45 - vSize)
        .attr("stroke", trunkColor)
        .attr("stroke-width", 6)
        .attr("stroke-linecap", "round")
        .attr("opacity", animated ? 0 : 1);
    }
  });
}

// ---- ANIMATION ----
function animateGrowth() {
  if (isAnimating) return;
  isAnimating = true;

  // redraw with all elements at opacity 0
  drawTrees(true);

  const treeGroups = gRoot.selectAll("g.tree");
  const totalQuarters = quarterDomain.length;
  const stepDuration = 350;

  for (let qIndex = 0; qIndex < totalQuarters; qIndex++) {
    const delay = qIndex * stepDuration;

    treeGroups.selectAll(`g.q[data-quarter-index="${qIndex}"]`).selectAll(".trunk-segment, .branch, .leaf, .split-branch")
      .transition()
      .delay(delay)
      .duration(stepDuration)
      .attr("opacity", d => {
        if (d && d.hasData === false && !d.stockSplits) {
          // still fade in faintly for trunk/branches; leaves may not exist anyway
          return 0.2;
        }
        return (this && d3.select(this).classed("leaf")) ? 0.9 : 1;
      });
  }

  const totalDuration = totalQuarters * stepDuration + 200;
  setTimeout(() => {
    isAnimating = false;
  }, totalDuration);
}
