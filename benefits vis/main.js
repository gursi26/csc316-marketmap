// object positions (percent of scene)
const benefitObjects = [
    { id:"health", category:"Insurance, Health, & Wellness", label:"Health & Wellness", img:"img/health-area.png", xPct:18, yPct:25 },
    { id:"home", category:"Home", label:"Home & Life", img:"img/home-area.png", xPct:72, yPct:30 },
    { id:"financial", category:"Financial & Retirement", label:"Financial & Retirement", img:"img/money-area.png", xPct:45, yPct:18 },
    { id:"perks", category:"Perks & Discounts", label:"Perks & Discounts", img:"img/perks-area.png", xPct:65, yPct:65 },
    { id:"transport", category:"Transportation", label:"Transportation", img:"img/transport-area.png", xPct:22, yPct:68 },
    { id:"other", category:"Other", label:"Other", img:"img/other-area.png", xPct:48, yPct:48 }
  ];
  
  const uniqueBase = { xPct:50, yPct:40 };
  const scene = d3.select("#scene");
  const tooltip = d3.select("#tooltip");
  const companySelect = d3.select("#companySelect");
  
  // scene size
  function sceneSize() {
    const n = document.getElementById("scene");
    return { width: n.clientWidth, height: n.clientHeight };
  }
  
  // draw objects
  function createObjects() {
    const { width, height } = sceneSize();
    const nodes = scene.selectAll(".benefit-object")
      .data(benefitObjects, d => d.id)
      .enter()
      .append("div")
      .attr("class", "benefit-object")
      .style("left", d => (d.xPct * width)/100 + "px")
      .style("top", d => (d.yPct * height)/100 + "px");
  
    nodes.append("img").attr("src", d => d.img).attr("alt", d => d.label);
    return nodes;
  }
  
  function showTip(html, e) {
    tooltip.classed("hidden", false)
      .html(html)
      .style("left", e.pageX + 12 + "px")
      .style("top", e.pageY - 8 + "px");
  }
  
  function hideTip() { tooltip.classed("hidden", true); }
  
  // load data
  d3.csv("../dataset/cleaned/Company-benefits.csv").then(all => {
    all.forEach(d => {
      d.Ticker = d.Ticker.trim();
      d["Benefit Category"] = d["Benefit Category"].trim();
      d["Benefit Description"] = d["Benefit Description"].trim();
    });
  
    const companies = Array.from(new Set(all.map(d => d.Ticker))).sort();
    companySelect.selectAll("option")
      .data(companies).enter()
      .append("option").text(d => d);
  
    const objNodes = createObjects();
    const initial = companySelect.property("value");
    updateCompany(initial, all, objNodes);
  
    companySelect.on("change", () => {
      updateCompany(companySelect.property("value"), all, objNodes);
    });
  
    // reposition on resize
    window.addEventListener("resize", () => {
      const { width, height } = sceneSize();
      scene.selectAll(".benefit-object")
        .style("left", d => (d.xPct * width)/100 + "px")
        .style("top", d => (d.yPct * height)/100 + "px");
    });
  });
  
  // main update
  function updateCompany(ticker, all, objNodes) {
    const subset = all.filter(d => d.Ticker === ticker);
    const catGroups = d3.group(subset, d => d["Benefit Category"]);
  
    const uniqueBenefits = subset.filter(d =>
      d["Benefit Category"].toLowerCase().startsWith("unique to")
    );
  
    const catsCount = new Set(subset.map(d => d["Benefit Category"])).size;
    d3.select("#summary").text(`${ticker} has ${subset.length} benefits in ${catsCount} categories.`);
  
    // activate matching objects
    objNodes
      .classed("active", d => (catGroups.get(d.category) || []).length > 0)
      .on("mousemove", function(e, d) {
        const benefits = catGroups.get(d.category) || [];
        if (!benefits.length) return hideTip();
  
        const list = benefits.map(b => `• ${b["Benefit Description"]}`)
          .slice(0, 12).join("<br>");
        const more = benefits.length > 12 ? "<br>…and more" : "";
  
        showTip(`<strong>${d.label}</strong><br>${list}${more}`, e);
      })
      .on("mouseleave", hideTip);
  
    // unique icons
    const { width, height } = sceneSize();
    const baseX = (uniqueBase.xPct * width)/100;
    const baseY = (uniqueBase.yPct * height)/100;
  
    const icons = scene.selectAll(".unique-icon")
      .data(uniqueBenefits, d => d["Benefit Description"]);
  
    icons.exit().remove();
  
    const enter = icons.enter().append("div")
      .attr("class", "unique-icon")
      .each(function(d) {
        const jx = (Math.random()-0.5)*160;
        const jy = (Math.random()-0.5)*80;
        d.x = baseX + jx;
        d.y = baseY + jy;
      })
      .style("left", d => d.x + "px")
      .style("top", d => d.y + "px");
  
    enter.append("img").attr("src", "img/unique-badge.png");
  
    enter.merge(icons)
      .on("mousemove", (e, d) => {
        showTip(
          `<strong>Unique Benefit</strong><br>${d["Benefit Description"]}`,
          e
        );
      })
      .on("mouseleave", hideTip);
  }
  