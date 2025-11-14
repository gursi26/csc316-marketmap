class MapVis {
  constructor() {
    this.initVis()
  }

  /* global d3, topojson, APP_CONFIG */
  initVis(){
    const cfg = APP_CONFIG;
    const svg = d3.select("#chart");

    // Draw order: states (fills + borders) → US buildings → foreign circles & buildings
    const gRoot      = svg.append("g").attr("id","gRoot");
    const gStates    = gRoot.append("g").attr("id","gStates");
    const gBorders   = gRoot.append("g").attr("id","gBorders");
    const gBuildings = gRoot.append("g").attr("id","gBuildings");
    const gForeign   = gRoot.append("g").attr("id","gForeign");
    const tooltip    = d3.select("#tooltip");

    // small floating menu for company options
    let companyPopup = null;
    function createCompanyPopup(){
      if (companyPopup) return companyPopup;
      companyPopup = document.createElement('div');
      // Use CSS classes so styling is centralized in CSS
      companyPopup.className = 'map-popup';
      companyPopup.setAttribute('role', 'dialog');
      companyPopup.setAttribute('aria-hidden', 'true');
      companyPopup.innerHTML = `
        <div class="map-popup-inner">
          <div id="cp-title" class="map-popup-title"></div>
          <div class="map-popup-actions">
            <button id="cp-details" class="btn-primary">Details</button>
            <button id="cp-roles" class="btn-primary">Pay Progression</button>
          </div>
        </div>
      `;
      document.body.appendChild(companyPopup);
      // ensure it's initially hidden for assistive tech
      companyPopup.style.display = 'none';
      return companyPopup;
    }

    function showCompanyPopup(event, company){
      const popup = createCompanyPopup();
      const title = popup.querySelector('#cp-title');
      const btnDetails = popup.querySelector('#cp-details');
      const btnRoles = popup.querySelector('#cp-roles');
      title.textContent = (company.Name || company.Ticker || 'Company');

      // position near mouse
      const x = (event.pageX || (event.clientX + window.scrollX)) + 8;
      const y = (event.pageY || (event.clientY + window.scrollY)) + 8;
      popup.style.left = x + 'px';
      popup.style.top = y + 'px';
      popup.style.display = '';

      // remove previous handlers
      btnDetails.onclick = null; btnRoles.onclick = null;

      btnDetails.onclick = function(ev){
        ev.stopPropagation();
        // navigate to scatter-plot index, pass ticker
        const t = encodeURIComponent(company.Ticker || '');
        window.location.href = `../scatter-plot%20vis/index.html?ticker=${t}`;
      };
      btnRoles.onclick = function(ev){
        ev.stopPropagation();
        // const t = encodeURIComponent(company.Ticker || '');
        // window.location.href = `../slope-chart%20vis/index.html?ticker=${t}`;
        hideCompanyPopup();
        navigateToSlopeMap(company.Ticker || '');
      };
    }

    function hideCompanyPopup(){
      if (companyPopup) companyPopup.style.display = 'none';
    }

    const mapW = 900, mapH = 650;
    const projection = d3.geoAlbersUsa().translate([mapW/2, mapH/2]).scale(1200);
    const path = d3.geoPath(projection);

    // UI
    const roleWrap     = d3.select("#roleSelect").node().parentElement;
    const roleSelect   = d3.select("#roleSelect");
    const heightRadios = d3.selectAll("input[name=heightMetric]");
    const colorRadios  = d3.selectAll("input[name=colorMetric]");
    const companyListEl = d3.select("#companyList");

    // Data
    let companies = [], salaries = [], financials = [], prices = [];

    // Zoom state
    let zoomTarget = null;   // {type:'state', id}
    let currentZoom = 1;     // scale factor applied to gRoot; buildings counter-scale by 1/currentZoom
    
    // Filter state
    let selectedCompanyTicker = null; // ticker of filtered company, or null for no filter

    // Load
    Promise.all([
      d3.csv(`${cfg.dataDir}/${cfg.files.info}`),
      d3.csv(`${cfg.dataDir}/${cfg.files.salary}`),
      d3.csv(`${cfg.dataDir}/${cfg.files.financials}`),
      d3.csv(`${cfg.dataDir}/${cfg.files.prices}`),
      d3.json("https://unpkg.com/us-atlas@3/states-10m.json")
    ]).then(([info, salary, fin, price, usTopo])=>{
      companies  = sanitizeInfo(info);
      salaries   = salary;
      financials = fin;
      prices     = price;

      const states = topojson.feature(usTopo, usTopo.objects.states).features;

      // Fills
      gStates.selectAll("path.state")
        .data(states)
        .join("path")
        .attr("class","state")
        .attr("d", path)
        .on("click", onStateClick);

      // Borders BELOW buildings
      gBorders.append("path")
        .attr("fill","none")
        .attr("stroke","#2a3357")
        .attr("stroke-linejoin","round")
        .attr("d", path(topojson.mesh(usTopo, usTopo.objects.states, (a,b)=>a!==b)));

      setupUI();
      render();
    }).catch(err => {
      console.error(err);
      alert("Failed to load data. Check the /data folder filenames.");
    });

    // -------- header helpers --------
    const canon = s => (s||"").toString().toLowerCase().replace(/[^a-z0-9]/g,"");
    const pick  = (o, names) => {
      const keys = Object.keys(o), want = names.map(canon);
      for (const k of keys){ if (want.includes(canon(k))) return o[k]; }
      return undefined;
    };

    function sanitizeInfo(info){
      return info.map(d=>{
        const Longitude = +pick(d, ["Longitude","lng","lon","long"]);
        const Latitude  = +pick(d, ["Latitude","lat"]);
        const employee_rating = +pick(d, ["employee rating","employeerating","rating"]);
        const ceo_approval    = +pick(d, ["ceo approval percentage","ceoapproval","ceoapprovalpercentage","ceo%"]);
        const Ticker          = pick(d, ["Ticker","symbol","tickr"]);
        const Name            = pick(d, ["Name","company name","company"]);
        const Address         = pick(d, ["Address","address1","hq address"]);
        const Country         = pick(d, ["Country","country"]);
        const State           = pick(d, ["State","state","region","province"]);
        return { ...d, Longitude, Latitude, employee_rating, ceo_approval, Ticker, Name, Address, Country, State, market_cap:null };
      });
    }

    // ---- Scales ----
    const heightScaleSalary = d3.scaleLinear();                 // set each render
    const heightScaleReturn = d3.scaleLinear().domain([-50,150]).range([10,180]).clamp(true);
    const widthScale        = d3.scaleLinear().range([4,28]);   // log(mktcap) → px
    const colorScale        = d3.scaleLinear().domain([0,50,100]).range(["#d64d4d","#f0d34a","#36b37e"]).clamp(true);
    const stateSalaryScale  = d3.scaleSequential(d3.interpolateBlues);

    // ---- Accessors ----
    function getMarketCap(ticker){
      const row = financials.find(f => canon(f.Ticker)===canon(ticker));
      const mc = row ? (+pick(row, ["market cap","marketcap","mkt cap"])) : null;
      return isFinite(mc) ? mc : null;
    }
    function getRank1Salary(ticker, role){
      const rows = salaries.filter(s =>
        canon(s.Ticker)===canon(ticker) &&
        String(pick(s, ["Role rank","rolerank","rank"])).trim()==="1" &&
        canon(pick(s, ["Role name","rolename","role"]))===canon(role)
      );
      if (!rows.length) return null;
      const pay = +pick(rows[0], ["Total pay","totalpay","compensation","pay"]);
      return isFinite(pay) ? pay : null;
    }
    function getReturn2225(ticker){
      const p = prices.find(r => canon(r.Ticker)===canon(ticker));
      if (!p) return null;
      const p22 = +p["2022"], p25 = +p["2025"];
      if (!isFinite(p22) || !isFinite(p25) || p22===0) return null;
      return (p25/p22 - 1) * 100;
    }

    // ---- UI ----
    function setupUI(){
      // role options: count non-empty Pay data per role, sort by count descending
      const roleCounts = new Map();
      salaries.forEach(s => {
        const roleName = pick(s, ["Role name","rolename","role"]);
        const pay = pick(s, ["Total pay","totalpay","compensation","pay"]);
        if (!roleName) return;
        const payVal = pay ? String(pay).trim() : "";
        if (payVal && payVal !== "" && !isNaN(+payVal) && +payVal > 0) {
          roleCounts.set(roleName, (roleCounts.get(roleName) || 0) + 1);
        }
      });
      
      // Get unique roles from rank 1 entries, sort by data count
      const rank1Roles = Array.from(new Set(
        salaries.filter(s => String(pick(s, ["Role rank","rolerank","rank"])).trim()==="1")
                .map(s => pick(s, ["Role name","rolename","role"]))
                .filter(Boolean)
      ));
      
      const rolesSorted = rank1Roles.sort((a,b) => {
        const countA = roleCounts.get(a) || 0;
        const countB = roleCounts.get(b) || 0;
        return countB - countA; // descending
      });

      // Format role names: remove hyphens, capitalize properly
      const formatRoleName = (role) => {
        return role.split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
      };

      roleSelect.selectAll("option").data(rolesSorted).join("option")
        .attr("value", d=>d).text(d=>formatRoleName(d));

      // listeners
      roleSelect.on("change", () => { colorStates(); renderBuildings(); renderForeign(); updateCompanyList(); });
      heightRadios.on("change", () => { toggleRole(); colorStates(); renderBuildings(); renderForeign(); updateLegend(); updateCompanyList(); });
      colorRadios.on("change", () => { renderBuildings(); renderForeign(); updateLegend(); });

      toggleRole();
      buildLegendSkeleton();
      updateLegend();
      updateCompanyList();
    }

    function toggleRole(){
      const useSalary = d3.select('input[name=heightMetric]:checked').node().value === "salary";
      roleWrap.style.display = useSalary ? "" : "none";
    }

    // ---- Legend ----
    function buildLegendSkeleton(){
      const L = d3.select("#legendColor").html("");
      L.append("div").attr("class","caption");
      L.append("div").attr("class","bar");
      L.append("div").attr("class","ticks")
        .html('<span class="tick-left"></span><span class="tick-mid"></span><span class="tick-right"></span>');
    }
    function updateLegend(){
      const metric = d3.select('input[name=colorMetric]:checked').node().value;
      const L = d3.select("#legendColor");
      L.select(".caption").text(metric === "employee_rating" ? "Building color: Employee rating" : "Building color: CEO approval (%)");
      if (metric === "employee_rating"){
        L.select(".tick-left").text("0");
        L.select(".tick-mid").text("2.5");
        L.select(".tick-right").text("5");
      } else {
        L.select(".tick-left").text("0");
        L.select(".tick-mid").text("50");
        L.select(".tick-right").text("100");
      }
    }

    // ---- Company List ----
    function updateCompanyList(){
      const roleName = roleSelect.node().value;
      const hMetric = d3.select('input[name=heightMetric]:checked').node().value;

      // Get companies with valid data for current metric
      const companiesWithData = companies.map(c => {
        const hVal = hMetric==="salary" ? getRank1Salary(c.Ticker, roleName) : getReturn2225(c.Ticker);
        return { ...c, hVal };
      }).filter(c => c.hVal != null && isFinite(c.hVal));

      // Sort by height metric (descending)
      companiesWithData.sort((a,b) => b.hVal - a.hVal);

      // Render list
      const items = companyListEl.selectAll(".company-list-item")
        .data(companiesWithData, d => d.Ticker);

      const enter = items.enter()
        .append("div")
        .attr("class", "company-list-item");

      enter.append("span").attr("class", "company-name");
      enter.append("span").attr("class", "company-value");

      const all = enter.merge(items);

      all.classed("active", d => d.Ticker === selectedCompanyTicker);
      
      all.select(".company-name").text(d => d.Name || d.Ticker);
      
      all.select(".company-value").text(d => {
        if (hMetric === "salary") {
          return "$" + d3.format(",")(Math.round(d.hVal));
        } else {
          return d3.format(".1f")(d.hVal) + "%";
        }
      });

      all.on("click", function(event, d){
        event.stopPropagation();
        // Toggle selection: if same company, deselect; otherwise select
        if (selectedCompanyTicker === d.Ticker) {
          selectedCompanyTicker = null;
        } else {
          selectedCompanyTicker = d.Ticker;
        }
        updateCompanyList();
        renderBuildings();
        renderForeign();
      });

      // Reorder DOM elements to match the sorted data order
      all.order();

      items.exit().remove();
    }

    // ---- Render orchestrators ----
    function render(){
      // width scale from market cap (log)
      const mcs = companies.map(c => (c.market_cap = getMarketCap(c.Ticker), c.market_cap)).filter(v=>v>0);
      widthScale.domain(mcs.length ? d3.extent(mcs.map(v=>Math.log(v))) : [0,1]);
      colorStates();
      renderBuildings();
      renderForeign();
    }

    function colorStates(){
      const useSalary = d3.select('input[name=heightMetric]:checked').node().value === "salary";
      if (!useSalary){
        gStates.selectAll("path.state").attr("fill","#1a2447");
        return;
      }
      const roleName = roleSelect.node().value;
      const stateVals = new Map();
      companies.forEach(c=>{
        const v = getRank1Salary(c.Ticker, roleName);
        if (v==null || !c.State) return;
        if (!stateVals.has(c.State)) stateVals.set(c.State, []);
        stateVals.get(c.State).push(v);
      });
      const avg = new Map();
      stateVals.forEach((arr, st)=>avg.set(st, d3.mean(arr)));
      const vals = Array.from(avg.values());
      const [mn, mx] = vals.length ? d3.extent(vals) : [0,1];
      stateSalaryScale.domain([mn||0, mx||1]);

      const ab = {
        "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
        "Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI",
        "Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
        "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
        "Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
        "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
        "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
        "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA",
        "West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"
      };
      gStates.selectAll("path.state").attr("fill", d=>{
        const name = d.properties.name, code = ab[name] || name;
        const hit = Array.from(avg.entries()).find(([k]) => k===name || k===code);
        return hit ? stateSalaryScale(hit[1]) : "#1a2447";
      });
    }

    // ---- Buildings (2.5D) ----
    function renderBuildings(){
      const roleName  = roleSelect.node().value;
      const hMetric   = d3.select('input[name=heightMetric]:checked').node().value;
      const cMetric   = d3.select('input[name=colorMetric]:checked').node().value;

      const data = companies.map(c=>{
        const proj = (isFinite(c.Longitude) && isFinite(c.Latitude)) ? projection([c.Longitude, c.Latitude]) : null;
        const mc = c.market_cap;
        const widthPx = (mc && mc>0) ? widthScale(Math.log(mc)) : 6; // width by log market cap
        const hVal = hMetric==="salary" ? getRank1Salary(c.Ticker, roleName) : getReturn2225(c.Ticker);
        return { ...c, px: proj?proj[0]:null, py: proj?proj[1]:null, widthPx, hVal };
      }).filter(d=>d.px!=null && d.py!=null && d.hVal!=null)
        .filter(d => !selectedCompanyTicker || d.Ticker === selectedCompanyTicker); // filter by selection

      if (hMetric==="salary"){
        const [mn,mx] = d3.extent(data, d=>d.hVal);
        heightScaleSalary.domain([mn,mx]).range([10,180]).clamp(true);
      }

      const colorVal = d=>{
        if (cMetric==="employee_rating"){
          if (d.employee_rating==null) return null;
          return d.employee_rating<=5.5 ? (d.employee_rating/5)*100 : d.employee_rating;
        }
        return d.ceo_approval;
      };

      // tallest first; shorter drawn last (on top)
      data.sort((a,b)=>{
        const ha = hMetric==="salary" ? heightScaleSalary(a.hVal) : heightScaleReturn(a.hVal);
        const hb = hMetric==="salary" ? heightScaleSalary(b.hVal) : heightScaleReturn(b.hVal);
        return hb - ha;
      });

      const sel = gBuildings.selectAll("g.building").data(data, d=>d.Ticker);
      const enter = sel.enter().append("g").attr("class","building")
        .on("mousemove", (ev,d)=> showTip(ev, d, roleName, hMetric))
        .on("mouseleave", hideTip)
        .on("click", (ev, d) => {
          // show small popup with options
          try { showCompanyPopup(ev, d); } catch (e) {}
          // still postMessage for parent-aware embedding
          try {
            const payload = { Ticker: d.Ticker, Name: d.Name, Address: d.Address, State: d.State };
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'companyClick', data: payload }, '*');
            }
          } catch (e) {}
          ev.stopPropagation();
        });

      enter.append("path").attr("class","face-front");
      enter.append("path").attr("class","face-side");
      enter.append("path").attr("class","roof");
      enter.append("path").attr("class","outline");
      enter.append("g").attr("class","windows");

      const all = enter.merge(sel);

      // IMPORTANT: keep buildings at same on-screen size during zoom
      all.attr("transform", d => `translate(${d.px},${d.py}) scale(${1/currentZoom})`);

      all.each(function(d){
        const g = d3.select(this);
        const w = d.widthPx;
        const h = hMetric==="salary" ? heightScaleSalary(d.hVal) : heightScaleReturn(d.hVal);
        const depth = 3;                 // constant thin side depth
        const skew  = 0.6;

        const x0=-w/2, x1=w/2, y0=0, y1=-h;

        const front = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
        const sx0=x1, sy0=y0, sx1=x1+depth, sy1=y0-depth*skew, sx2=x1+depth, sy2=y1-depth*skew, sx3=x1, sy3=y1;
        const side  = `M ${sx0} ${sy0} L ${sx1} ${sy1} L ${sx2} ${sy2} L ${sx3} ${sy3} Z`;
        const rx0=x0, ry0=y1, rx1=x1, ry1=y1, rx2=x1+depth, ry2=y1-depth*skew, rx3=x0+depth, ry3=y1-depth*skew;
        const roof  = `M ${rx0} ${ry0} L ${rx1} ${ry1} L ${rx2} ${ry2} L ${rx3} ${ry3} Z`;

        const col = colorVal(d);
        const fill = (col==null) ? "#8b8b8b" : colorScale(col);
        const sideFill = d3.color(fill); if (sideFill) sideFill.opacity = 0.75;

        g.select(".face-front").attr("d", front).attr("fill", fill);
        g.select(".face-side").attr("d", side).attr("fill", sideFill ? sideFill.formatRgb() : fill);
        g.select(".roof").attr("d", roof).attr("fill", d3.color(fill).brighter(0.6));
        g.select(".outline").attr("d", front + " " + side + " " + roof);

        // Windows — rows depend on height; columns adapt to width (1–3)
        const winGroup = g.select("g.windows");
        const cols = (w < 8) ? 1 : (w < 16 ? 2 : 3);
        const colXs = (()=> {
          if (cols===1) return [x0 + w*0.5 - Math.min(2.5, w*0.22)];
          if (cols===2) return [x0 + w*0.18, x1 - w*0.18 - Math.min(3, w*0.22)];
          const gap = w/4;
          return [x0 + gap*0.9, x0 + 2*gap, x0 + 3*gap - Math.min(3, w*0.22)];
        })();
        const winW = Math.min(3, Math.max(1.2, w*0.18));
        const winH = 6, gapY = 6;
        const rows = Math.max(1, Math.floor((h - 12) / (winH + gapY)));
        const arr = [];
        for (let r=0;r<rows;r++){
          const yTop = y1 + 4 + r*(winH + gapY);
          colXs.forEach(xc => arr.push({x: xc, y: yTop, w: winW, h: winH}));
        }
        const winColor = d3.color(fill).brighter(1.1).formatRgb();
        const wSel = winGroup.selectAll("rect.window").data(arr);
        wSel.enter().append("rect").attr("class","window")
          .merge(wSel)
          .attr("x", d=>d.x).attr("y", d=>d.y).attr("width", d=>d.w).attr("height", d=>d.h)
          .attr("fill", winColor).attr("stroke","none").attr("opacity", 0.9);
        wSel.exit().remove();
      });

      sel.exit().remove();
    }

    // ---- Tooltip (closer + clamped) ----
    function showTip(event, d, roleName, hMetric){
      const mc = d.market_cap ? d3.format(".2s")(d.market_cap) : "n/a";
      const salary = getRank1Salary(d.Ticker, roleName);
      const ret    = getReturn2225(d.Ticker);
      const rating = d.employee_rating!=null ? d3.format(".2f")(d.employee_rating) : "n/a";
      const ceo    = d.ceo_approval!=null ? d3.format(".0f")(d.ceo_approval) + "%" : "n/a";
      const hStr   = (hMetric==="salary")
        ? (salary!=null ? "$" + d3.format(",")(Math.round(salary)) : "n/a")
        : (ret!=null ? d3.format(".1f")(ret)+"%" : "n/a");

      tooltip.html(`
        <div><strong>${d.Name || d.Ticker}</strong></div>
        <div>${d.Address || ""}</div>
        <hr style="border:0;border-top:1px solid rgba(255,255,255,.12); margin:6px 0">
        <div>Height: <b>${hStr}</b></div>
        <div>Employee rating: <b>${rating}</b></div>
        <div>CEO approval: <b>${ceo}</b></div>
        <div>Market cap (width): <b>${mc}</b></div>
      `).style("display","block");

      const pad = 6;
      const rect = tooltip.node().getBoundingClientRect();
      let x = event.pageX + pad, y = event.pageY + pad;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (x + rect.width > vw)  x = vw - rect.width - pad;
      if (y + rect.height > vh) y = vh - rect.height - pad;
      tooltip.style("left", x + "px").style("top", y + "px");
    }
    function hideTip(){ tooltip.style("display","none"); }

    // ---- Foreign (country circles + mini buildings) ----
    function renderForeign(){
      const foreign = companies.filter(c => (c.Country||"").trim().toLowerCase() !== "united states" && (c.Country||"").trim()!=="")
        .filter(c => !selectedCompanyTicker || c.Ticker === selectedCompanyTicker); // filter by selection
      const byCountry = d3.group(foreign, d=>d.Country);
      const countries = Array.from(byCountry.keys()).sort();
      const centerX = 1000, startY = 60, vSpacing = 110;

      const data = countries.map((c,i)=>({name:c, items:byCountry.get(c), i}));
      const groups = gForeign.selectAll("g.country").data(data, d=>d.name);
      const enter = groups.enter().append("g").attr("class","country")
        .attr("transform", d => `translate(${centerX}, ${startY + d.i*vSpacing})`);

      // circle & label always visible
      enter.append("circle").attr("class","country-circle");
      enter.append("text").attr("class","country-label");

      const all = enter.merge(groups);
      all.select("circle.country-circle")
        .attr("r", d => 26 + Math.sqrt(d.items.length)*3);
      all.select("text.country-label")
        .attr("y", d => -(26 + Math.sqrt(d.items.length)*3) - 8)
        .text(d => d.name);

      // Mini buildings inside circle (update on every control change)
      all.each(function(d){
        const g = d3.select(this);
        const n = d.items.length;
        const R = 26 + Math.sqrt(n)*3;

        const bSel = g.selectAll("g.mini-building").data(d.items, dd=>dd.Ticker);
        const bEnter = bSel.enter().append("g").attr("class","mini-building")
          .on("mousemove", (ev,dd)=> showTip(ev, dd, roleSelect.node().value, d3.select('input[name=heightMetric]:checked').node().value))
          .on("mouseleave", hideTip)
          .on("click", (ev, dd) => {
            try { showCompanyPopup(ev, dd); } catch (e) {}
            try {
              const payload = { Ticker: dd.Ticker, Name: dd.Name, Address: dd.Address, State: dd.State };
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'companyClick', data: payload }, '*');
              }
            } catch (e) {}
            ev.stopPropagation();
          });

        bEnter.append("path").attr("class","face-front");
        bEnter.append("path").attr("class","face-side");
        bEnter.append("path").attr("class","roof");
        bEnter.append("path").attr("class","outline");
        bEnter.append("g").attr("class","windows");

        const hMet = d3.select('input[name=heightMetric]:checked').node().value;
        const cMet = d3.select('input[name=colorMetric]:checked').node().value;

        bEnter.merge(bSel).each(function(dd, i){
          // arrange around circle
          const a = (i / Math.max(1,n)) * 2*Math.PI;
          const cx = Math.cos(a) * (R-10) * 0.7;
          const cy = Math.sin(a) * (R-10) * 0.7;
          const gB = d3.select(this).attr("transform", `translate(${cx},${cy}) scale(${1/currentZoom})`); // keep size constant during state zoom

          // dimensions scaled down
          const mc = getMarketCap(dd.Ticker);
          const w  = (mc && mc>0) ? Math.max(3, widthScale(Math.log(mc))*0.55) : 4;
          const val= hMet==="salary" ? getRank1Salary(dd.Ticker, roleSelect.node().value) : getReturn2225(dd.Ticker);
          const h  = (hMet==="salary" ? heightScaleSalary(val||0) : heightScaleReturn(val||0)) * 0.55;

          const depth = 3, skew = 0.6;
          const x0=-w/2, x1=w/2, y0=0, y1=-h;

          const front = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
          const sx0=x1, sy0=y0, sx1=x1+depth, sy1=y0-depth*skew, sx2=x1+depth, sy2=y1-depth*skew, sx3=x1, sy3=y1;
          const side  = `M ${sx0} ${sy0} L ${sx1} ${sy1} L ${sx2} ${sy2} L ${sx3} ${sy3} Z`;
          const rx0=x0, ry0=y1, rx1=x1, ry1=y1, rx2=x1+depth, ry2=y1-depth*skew, rx3=x0+depth, ry3=y1-depth*skew;
          const roof  = `M ${rx0} ${ry0} L ${rx1} ${ry1} L ${rx2} ${ry2} L ${rx3} ${ry3} Z`;

          const cval = (cMet==="employee_rating")
            ? (dd.employee_rating!=null ? (dd.employee_rating<=5.5 ? (dd.employee_rating/5)*100 : dd.employee_rating) : null)
            : dd.ceo_approval;
          const fill = (cval==null) ? "#8b8b8b" : colorScale(cval);
          const sideFill = d3.color(fill); if (sideFill) sideFill.opacity = 0.75;

          gB.select(".face-front").attr("d", front).attr("fill", fill);
          gB.select(".face-side").attr("d", side).attr("fill", sideFill ? sideFill.formatRgb() : fill);
          gB.select(".roof").attr("d", roof).attr("fill", d3.color(fill).brighter(0.6));
          gB.select(".outline").attr("d", front + " " + side + " " + roof);

          // mini windows
          const winGroup = gB.select("g.windows");
          const cols = (w < 7) ? 1 : 2;
          const colXs = (cols===1)
            ? [x0 + w*0.5 - Math.min(2.5, w*0.22)]
            : [x0 + w*0.18, x1 - w*0.18 - Math.min(3, w*0.22)];
          const winW = Math.min(3, Math.max(1, w*0.18));
          const winH = 4, gapY = 4;
          const rows = Math.max(1, Math.floor((h - 10) / (winH + gapY)));
          const arr = [];
          for (let r=0;r<rows;r++){
            const yTop = y1 + 3 + r*(winH + gapY);
            colXs.forEach(xc => arr.push({x: xc, y: yTop, w: winW, h: winH}));
          }
          const winColor = d3.color(fill).brighter(1.1).formatRgb();
          const wSel = winGroup.selectAll("rect.window").data(arr);
          wSel.enter().append("rect").attr("class","window")
            .merge(wSel)
            .attr("x", d=>d.x).attr("y", d=>d.y).attr("width", d=>d.w).attr("height", d=>d.h)
            .attr("fill", winColor).attr("stroke","none").attr("opacity", 0.9);
          wSel.exit().remove();
        });
        bSel.exit().remove();
      });

      groups.exit().remove();
    }

    // ---- Zooming: map zooms, buildings keep original on-screen size & positions ----
    function onStateClick(event, d){
      event.stopPropagation();
      const id = `state:${d.id || d.properties.name}`;
      if (zoomTarget && zoomTarget.id===id) { resetView(); return; }

      gStates.selectAll(".state").classed("state-active", false);
      d3.select(this).classed("state-active", true);

      const b = path.bounds(d);
      const dx = b[1][0] - b[0][0];
      const dy = b[1][1] - b[0][1];
      const s  = Math.min(8, 0.9 / Math.max(dx / mapW, dy / mapH));
      const tx = mapW/2 - s * (b[0][0] + b[1][0]) / 2;
      const ty = mapH/2 - s * (b[0][1] + b[1][1]) / 2;

      currentZoom = s;                         // update zoom factor used by building transforms
      gRoot.transition().duration(750)
        .attr("transform", `translate(${tx},${ty}) scale(${s})`)
        .on("end", ()=>{ zoomTarget = {type:"state", id}; });

      // Update building transforms to include counter-scale at their anchors
      gBuildings.selectAll("g.building")
        .transition().duration(750)
        .attr("transform", function(d){ return `translate(${d.px},${d.py}) scale(${1/currentZoom})`; });

      // Also keep mini buildings inside country circles readable during zoom
      gForeign.selectAll("g.mini-building")
        .transition().duration(750)
        .attr("transform", function(){
          // preserve existing translate; append counter-scale
          const t = d3.select(this).attr("transform") || "";
          const translated = t.replace(/scale\([^)]*\)/g,""); // remove prior scale
          return `${translated} scale(${1/currentZoom})`;
        });
    }

    function resetView(){
      gStates.selectAll(".state").classed("state-active", false);
      currentZoom = 1;
      gRoot.transition().duration(600).attr("transform","translate(0,0) scale(1)");
      gBuildings.selectAll("g.building")
        .transition().duration(600)
        .attr("transform", d => `translate(${d.px},${d.py}) scale(1)`);
      gForeign.selectAll("g.mini-building")
        .transition().duration(600)
        .attr("transform", function(){
          const t = d3.select(this).attr("transform") || "";
          const translated = t.replace(/scale\([^)]*\)/g,"");
          return `${translated} scale(1)`;
        });
      zoomTarget = null;
    }

    // Click empty space to reset
    svg.on("click", function(){
      if (zoomTarget) resetView();
      // Also reset company filter
      if (selectedCompanyTicker) {
        selectedCompanyTicker = null;
        updateCompanyList();
        renderBuildings();
        renderForeign();
      }
    });

    // hide popup when clicking outside
    document.addEventListener('click', () => { hideCompanyPopup(); });

    // allow parent to request view reset
    window.addEventListener('message', (ev) => {
      const msg = ev && ev.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'resetSelection') {
        try { resetView(); } catch (e) {}
      }
    }, false);

  }

}