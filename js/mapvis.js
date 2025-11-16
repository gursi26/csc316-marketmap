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

      // Prevent clicks on the popup from closing it
      popup.onclick = function(ev){
        ev.stopPropagation();
      };

      // remove previous handlers
      btnDetails.onclick = null; btnRoles.onclick = null;

      btnDetails.onclick = function(ev){
        ev.stopPropagation();
        // const t = encodeURIComponent(company.Ticker || '');
        // window.location.href = `../scatter-plot%20vis/index.html?ticker=${t}`;
        hideCompanyPopup();
        focusTicker(company.Ticker || '');
        scrollToSection(2);
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

    // Data
    let companies = [], salaries = [], financials = [], prices = [];
    let industryMapping = {};
    let industryIcons = {}; // cache for loaded images

    // Zoom state
    let zoomTarget = null;   // {type:'state', id}
    let currentZoom = 1;     // scale factor applied to gRoot; buildings counter-scale by 1/currentZoom

    // Load
    Promise.all([
      d3.csv(`${cfg.dataDir}/${cfg.files.info}`),
      d3.csv(`${cfg.dataDir}/${cfg.files.salary}`),
      d3.csv(`${cfg.dataDir}/${cfg.files.financials}`),
      d3.csv(`${cfg.dataDir}/${cfg.files.prices}`),
      d3.json("https://unpkg.com/us-atlas@3/states-10m.json"),
      d3.json("dataset/building-icons/industry-mapping.json")
    ]).then(([info, salary, fin, price, usTopo, indMapping])=>{
      companies  = sanitizeInfo(info);
      salaries   = salary;
      financials = fin;
      prices     = price;
      industryMapping = indMapping;

      // Preload building icons
      const categories = Object.keys(industryMapping);
      categories.forEach(cat => {
        const img = new Image();
        img.src = `dataset/building-icons/${cat}.png`;
        industryIcons[cat] = img;
      });

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

      // No UI controls needed - filters removed
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
    const widthScale        = d3.scaleLinear().range([4,28]);   // log(mktcap) → px

    // ---- Accessors ----
    function getMarketCap(ticker){
      const row = financials.find(f => canon(f.Ticker)===canon(ticker));
      const mc = row ? (+pick(row, ["market cap","marketcap","mkt cap"])) : null;
      return isFinite(mc) ? mc : null;
    }

    // Helper function to map industry to icon category
    function getIndustryCategory(industry) {
      if (!industry) return null;
      for (const [category, industries] of Object.entries(industryMapping)) {
        if (industries.includes(industry)) {
          return category;
        }
      }
      return null;
    }

    // ---- Render orchestrators ----
    function render(){
      // width scale from market cap (log)
      const mcs = companies.map(c => (c.market_cap = getMarketCap(c.Ticker), c.market_cap)).filter(v=>v>0);
      widthScale.domain(mcs.length ? d3.extent(mcs.map(v=>Math.log(v))) : [0,1]);
      // Keep states simple color
      gStates.selectAll("path.state").attr("fill","#1a2447");
      renderBuildings();
      renderForeign();
    }

    // ---- Buildings (icons for US companies) ----
    function renderBuildings(){
      const data = companies.map(c=>{
        const proj = (isFinite(c.Longitude) && isFinite(c.Latitude)) ? projection([c.Longitude, c.Latitude]) : null;
        const mc = c.market_cap;
        const industry = pick(c, ["Industry"]);
        const category = getIndustryCategory(industry);
        return { ...c, px: proj?proj[0]:null, py: proj?proj[1]:null, mc, category };
      }).filter(d=>d.px!=null && d.py!=null && d.category!=null);

      const sel = gBuildings.selectAll("g.building").data(data, d=>d.Ticker);
      const enter = sel.enter().append("g").attr("class","building")
        .on("mousemove", (ev,d)=> showTip(ev, d))
        .on("mouseleave", hideTip)
        .on("click", (ev, d) => {
          try { showCompanyPopup(ev, d); } catch (e) {}
          try {
            const payload = { Ticker: d.Ticker, Name: d.Name, Address: d.Address, State: d.State };
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'companyClick', data: payload }, '*');
            }
          } catch (e) {}
          ev.stopPropagation();
        });

      enter.append("image").attr("class","building-icon");

      const all = enter.merge(sel);

      // Keep icons at same on-screen size during zoom
      all.attr("transform", d => `translate(${d.px},${d.py}) scale(${1/currentZoom})`);

      all.each(function(d){
        const g = d3.select(this);
        const icon = industryIcons[d.category];
        if (!icon) return;
        
        // Size based on market cap (logarithmic scale)
        const baseSize = 30;
        const sizeMultiplier = d.mc && d.mc > 0 ? Math.log(d.mc) / 20 : 1;
        const size = Math.max(20, Math.min(60, baseSize * sizeMultiplier));
        
        g.select("image.building-icon")
          .attr("href", icon.src)
          .attr("x", -size/2)
          .attr("y", -size)
          .attr("width", size)
          .attr("height", size)
          .style("cursor", "pointer");
      });

      sel.exit().remove();
    }

    // ---- Tooltip (closer + clamped) ----
    function showTip(event, d){
      const mc = d.mc ? d3.format(".2s")(d.mc) : "n/a";
      const rating = d.employee_rating!=null ? d3.format(".2f")(d.employee_rating) : "n/a";
      const ceo    = d.ceo_approval!=null ? d3.format(".0f")(d.ceo_approval) + "%" : "n/a";
      const industry = pick(d, ["Industry"]) || "n/a";
      const sector = pick(d, ["Sector"]) || "n/a";

      tooltip.html(`
        <div><strong>${d.Name || d.Ticker}</strong></div>
        <div>${d.Address || ""}</div>
        <hr style="border:0;border-top:1px solid rgba(255,255,255,.12); margin:6px 0">
        <div>Industry: <b>${industry}</b></div>
        <div>Sector: <b>${sector}</b></div>
        <div>Employee rating: <b>${rating}</b></div>
        <div>CEO approval: <b>${ceo}</b></div>
        <div>Market cap: <b>${mc}</b></div>
      `).style("display","block");

      const pad = 6;
      const rect = tooltip.node().getBoundingClientRect();
      let x = event.pageX - 300, y = event.pageY - 100;
      const vw = window.innerWidth, vh = window.innerHeight;
      if (x + rect.width > vw)  x = vw - rect.width - pad;
      if (y + rect.height > vh) y = vh - rect.height - pad;
      tooltip.style("left", x + "px").style("top", y + "px");
    }
    function hideTip(){ tooltip.style("display","none"); }

    // ---- Foreign (country circles + mini buildings) ----
    function renderForeign(){
      const foreign = companies.filter(c => (c.Country||"").trim().toLowerCase() !== "united states" && (c.Country||"").trim()!=="");
      const byCountry = d3.group(foreign, d=>d.Country);
      const countries = Array.from(byCountry.keys()).sort();
      const centerX = 1000, startY = 10, vSpacing = 110;

      const data = countries.map((c,i)=>({name:c, items:byCountry.get(c), i}));
      const groups = gForeign.selectAll("g.country").data(data, d=>d.name);
      const enter = groups.enter().append("g").attr("class","country")
        .attr("transform", d => `translate(${centerX}, ${startY + d.i*vSpacing})`);

      // circle & label always visible
      enter.append("circle").attr("class","country-circle");
      enter.append("text").attr("class","country-label");

      const all = enter.merge(groups);
      all.select("circle.country-circle")
        .attr("r", d => 26 + Math.sqrt(d.items.length)*3)
        .style("cursor", "pointer")
        .on("click", (event, d) => onCountryClick(event, d, centerX, startY, vSpacing));
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
          .on("mousemove", (ev,dd)=> showTip(ev, dd))
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

        bEnter.append("circle").attr("class","mini-marker");

        bEnter.merge(bSel).each(function(dd, i){
          // arrange around circle
          const a = (i / Math.max(1,n)) * 2*Math.PI;
          const cx = Math.cos(a) * (R-10) * 0.7;
          const cy = Math.sin(a) * (R-10) * 0.7;
          const gB = d3.select(this).attr("transform", `translate(${cx},${cy}) scale(${1/currentZoom})`); // keep size constant during state zoom

          // Simple circle marker for foreign companies
          const mc = getMarketCap(dd.Ticker);
          const radius = mc && mc > 0 ? Math.max(3, Math.min(8, Math.log(mc) / 3)) : 4;
          
          gB.select("circle.mini-marker")
            .attr("r", radius)
            .attr("fill", "#4a9eff")
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5);
        });
        bSel.exit().remove();
      });

      groups.exit().remove();
    }

    // ---- Zooming: map zooms, buildings keep original on-screen size & positions ----
    function onStateClick(event, d){
      event.stopPropagation();
      hideCompanyPopup(); // Close popup when clicking on a state
      const id = `state:${d.id || d.properties.name}`;
      if (zoomTarget && zoomTarget.id===id) { resetView(); return; }

      gStates.selectAll(".state").classed("state-active", false);
      d3.select(this).classed("state-active", true).raise();

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

    function onCountryClick(event, d, centerX, startY, vSpacing){
      event.stopPropagation();
      hideCompanyPopup(); // Close popup when clicking on a country
      const id = `country:${d.name}`;
      if (zoomTarget && zoomTarget.id===id) { resetView(); return; }

      // Remove state active class if any
      gStates.selectAll(".state").classed("state-active", false);
      
      // Remove previous country active class and add to clicked circle
      gForeign.selectAll("circle.country-circle").classed("country-circle-active", false);
      d3.select(event.currentTarget).classed("country-circle-active", true);
      
      // Calculate country circle position and bounds
      const cx = centerX;
      const cy = startY + d.i * vSpacing;
      const r = 26 + Math.sqrt(d.items.length) * 3;
      
      // Calculate zoom: center on circle with some padding
      const padding = 80; // extra space around the circle
      const s = Math.min(8, Math.min(mapW / (2*r + padding), mapH / (2*r + padding)));
      const tx = mapW/2 - s * cx;
      const ty = mapH/2 - s * cy;

      currentZoom = s;
      gRoot.transition().duration(750)
        .attr("transform", `translate(${tx},${ty}) scale(${s})`)
        .on("end", ()=>{ zoomTarget = {type:"country", id}; });

      // Update building transforms to include counter-scale at their anchors
      gBuildings.selectAll("g.building")
        .transition().duration(750)
        .attr("transform", function(d){ return `translate(${d.px},${d.py}) scale(${1/currentZoom})`; });

      // Also keep mini buildings inside country circles readable during zoom
      gForeign.selectAll("g.mini-building")
        .transition().duration(750)
        .attr("transform", function(){
          const t = d3.select(this).attr("transform") || "";
          const translated = t.replace(/scale\([^)]*\)/g,"");
          return `${translated} scale(${1/currentZoom})`;
        });
    }

    function resetView(){
      gStates.selectAll(".state").classed("state-active", false);
      gForeign.selectAll("circle.country-circle").classed("country-circle-active", false);
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

    // Click empty space to reset zoom
    svg.on("click", function(){
      hideCompanyPopup(); // Close the popup when clicking anywhere on the map
      if (zoomTarget) resetView();
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