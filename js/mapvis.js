class MapVis {
  constructor() {
    this.initVis()
  }

  /* global d3, topojson, APP_CONFIG */
  initVis(){
    const cfg = APP_CONFIG;
    const svg = d3.select("#chart");

    // Add pixelation filter to SVG
    const defs = svg.append("defs");
    const pixelFilter = defs.append("filter")
      .attr("id", "pixelate")
      .attr("x", "0%")
      .attr("y", "0%")
      .attr("width", "100%")
      .attr("height", "100%");
    
    // Reduce resolution for pixelation effect
    pixelFilter.append("feGaussianBlur")
      .attr("stdDeviation", "0.5");
    
    pixelFilter.append("feComponentTransfer")
      .append("feFuncA")
      .attr("type", "discrete")
      .attr("tableValues", "0 1");

    // Draw order: states (fills + borders) → US buildings → foreign circles & buildings
    const gRoot      = svg.append("g").attr("id","gRoot");
    const gStates    = gRoot.append("g").attr("id","gStates").style("filter", "url(#pixelate)");
    const gBorders   = gRoot.append("g").attr("id","gBorders").style("filter", "url(#pixelate)");
    const gBuildings = gRoot.append("g").attr("id","gBuildings");
    const gForeign   = gRoot.append("g").attr("id","gForeign");
    const tooltip    = d3.select("#tooltip");
    const stateLabel = d3.select("#state-label");
    const barChartContainer = d3.select("#companies-bar-chart");
    const statePanelTitle = d3.select("#state-panel-title");
    const layoutEl = document.querySelector('.layout');

    // Track current selected state
    let currentSelectedState = null;
    let isStateZoomed = false; // Track if we're zoomed into a state

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
    // Reduced initial scale so full US + side foreign circles fit without pre-zoom feel
    const projection = d3.geoAlbersUsa().translate([mapW/2, mapH/2]).scale(950);
    const path = d3.geoPath(projection);
    
    // Store state geometries for boundary checking
    let stateGeometries = new Map();
    
    // Helper to constrain point within state boundaries
    function constrainToState(longitude, latitude, stateName, padding = 0.08) {
      let [x, y] = projection([longitude, latitude]) || [null, null];
      if (x === null || y === null) return null;
      
      // Try to get state geometry with both full name and abbreviation
      let stateGeom = stateGeometries.get(stateName);
      if (!stateGeom) {
        const stateAbbr = stateNameToAbbr[stateName];
        if (stateAbbr) stateGeom = stateGeometries.get(stateAbbr);
      }
      if (!stateGeom) {
        for (const [fullName, abbr] of Object.entries(stateNameToAbbr)) {
          if (abbr === stateName) {
            stateGeom = stateGeometries.get(fullName);
            break;
          }
        }
      }
      if (!stateGeom) return [x, y]; // fallback if no geometry
      
      const bounds = path.bounds(stateGeom);
      const [[x0, y0], [x1, y1]] = bounds;
      const padX = (x1 - x0) * padding;
      const padY = (y1 - y0) * padding;
      
      // Constrain within padded bounds
      x = Math.max(x0 + padX, Math.min(x1 - padX, x));
      y = Math.max(y0 + padY, Math.min(y1 - padY, y));
      
      return [x, y];
    }

    // Data
    let companies = [], salaries = [], financials = [], prices = [];
    let industryMapping = {};
    let industryIcons = {}; // cache for loaded images

    // Zoom state
    let zoomTarget = null;   // {type:'state', id}
    let currentZoom = 1;     // scale factor applied to gRoot; buildings counter-scale by 1/currentZoom
    
    // State name to abbreviation mapping
    const stateNameToAbbr = {
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
      
      // Store state geometries for boundary checking
      states.forEach(s => {
        const name = s.properties.name;
        stateGeometries.set(name, s);
        // Also store by common abbreviations
        const abbr = stateNameToAbbr[name];
        if (abbr) stateGeometries.set(abbr, s);
      });

      // Fills
      gStates.selectAll("path.state")
        .data(states)
        .join("path")
        .attr("class","state")
        .attr("d", path)
        .on("click", onStateClick)
        .on("mouseenter", function(event, d) {
          stateLabel.text(d.properties.name).classed("visible", true);
        })
        .on("mouseleave", function() {
          stateLabel.classed("visible", false);
        });

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

    // Helper to check if a point is inside a state's actual polygon geometry
    function isPointInState(x, y, stateGeom) {
      if (!stateGeom) return false;
      
      // Use D3's geoContains which works with GeoJSON features
      const coords = projection.invert([x, y]);
      if (!coords) return false;
      
      try {
        return d3.geoContains(stateGeom, coords);
      } catch (e) {
        return false;
      }
    }

    // Collision detection and position adjustment with force-directed layout
    function resolveCollisions(data) {
      // Group by state for more efficient collision detection
      const byState = d3.group(data, d => pick(d, ["State"]));
      const adjusted = [];
      
      byState.forEach((stateCompanies, stateName) => {
        // Try to get state geometry with both full name and abbreviation
        let stateGeom = stateGeometries.get(stateName);
        if (!stateGeom) {
          const stateAbbr = stateNameToAbbr[stateName];
          if (stateAbbr) {
            stateGeom = stateGeometries.get(stateAbbr);
          }
        }
        // Also try reverse lookup
        if (!stateGeom) {
          for (const [fullName, abbr] of Object.entries(stateNameToAbbr)) {
            if (abbr === stateName) {
              stateGeom = stateGeometries.get(fullName);
              break;
            }
          }
        }
        
        if (!stateGeom) {
          // If no geometry found, just pass through with original positions
          stateCompanies.forEach(c => {
            adjusted.push({
              ...c,
              finalX: c.px,
              finalY: c.py,
              size: 30,
              radius: 21
            });
          });
          return;
        }
        
        const bounds = path.bounds(stateGeom);
        const [[x0, y0], [x1, y1]] = bounds;
        const stateWidth = x1 - x0;
        const stateHeight = y1 - y0;
        const stateCenterX = (x0 + x1) / 2;
        const stateCenterY = (y0 + y1) / 2;
        
        // Calculate sizes first and ensure initial positions are within actual state polygon
        const companies = stateCompanies.map(company => {
          const baseSize = 30;
          const sizeMultiplier = company.mc && company.mc > 0 ? Math.log(company.mc) / 20 : 1;
          const size = Math.max(20, Math.min(60, baseSize * sizeMultiplier));
          
          // Use tighter padding
          const padX = stateWidth * 0.12;
          const padY = stateHeight * 0.12;
          
          let px = company.px;
          let py = company.py;
          
          // Verify position is within the actual state polygon, not just bounding box
          if (!isPointInState(px, py, stateGeom) || 
              px < x0 + padX || px > x1 - padX || 
              py < y0 + padY || py > y1 - padY) {
            // Start at center and verify it's in the polygon
            px = stateCenterX;
            py = stateCenterY;
            
            // If center is not in polygon, search for a valid point
            if (!isPointInState(px, py, stateGeom)) {
              let found = false;
              for (let attempt = 0; attempt < 50; attempt++) {
                const testX = x0 + padX + Math.random() * (stateWidth - 2 * padX);
                const testY = y0 + padY + Math.random() * (stateHeight - 2 * padY);
                if (isPointInState(testX, testY, stateGeom)) {
                  px = testX;
                  py = testY;
                  found = true;
                  break;
                }
              }
              // If still not found, use centroid
              if (!found) {
                const centroid = path.centroid(stateGeom);
                if (centroid && isFinite(centroid[0]) && isFinite(centroid[1])) {
                  px = centroid[0];
                  py = centroid[1];
                }
              }
            }
          }
          
          return {
            ...company,
            px: px,
            py: py,
            size: size,
            radius: size * 0.8,
            vx: 0,
            vy: 0,
            originalState: stateName,
            stateGeom: stateGeom,
            stateBounds: { x0, y0, x1, y1, width: stateWidth, height: stateHeight, centerX: stateCenterX, centerY: stateCenterY }
          };
        });
        
        // Sort by market cap descending
        companies.sort((a, b) => (b.mc || 0) - (a.mc || 0));
        
        // Use enhanced force simulation for better distribution
        const iterations = 350; // Increased iterations
        const minSpacing = 10; // Minimum spacing between companies
        
        for (let iter = 0; iter < iterations; iter++) {
          // Decay force strength over iterations for stability
          const alpha = 0.4 * (1 - iter / iterations * 0.7);
          
          // Reset velocities
          companies.forEach(c => { c.vx = 0; c.vy = 0; });
          
          // Collision forces between buildings (repulsion)
          for (let i = 0; i < companies.length; i++) {
            for (let j = i + 1; j < companies.length; j++) {
              const a = companies[i];
              const b = companies[j];
              
              const dx = b.px - a.px;
              const dy = b.py - a.py;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const minDist = a.radius + b.radius + minSpacing;
              
              if (dist < minDist && dist > 0.1) {
                // Moderate repulsion when close
                const overlapRatio = (minDist - dist) / minDist;
                const force = overlapRatio * alpha;
                const fx = (dx / dist) * force * 15;
                const fy = (dy / dist) * force * 15;
                
                a.vx -= fx;
                a.vy -= fy;
                b.vx += fx;
                b.vy += fy;
              }
            }
          }
          
          // Apply velocities and strictly enforce state polygon boundaries
          companies.forEach(c => {
            let newPx = c.px + c.vx;
            let newPy = c.py + c.vy;
            
            // Use tighter padding
            const padX = c.stateBounds.width * 0.12;
            const padY = c.stateBounds.height * 0.12;
            
            // First, clamp to bounding box
            newPx = Math.max(c.stateBounds.x0 + padX, Math.min(c.stateBounds.x1 - padX, newPx));
            newPy = Math.max(c.stateBounds.y0 + padY, Math.min(c.stateBounds.y1 - padY, newPy));
            
            // Then verify it's inside the actual polygon
            if (isPointInState(newPx, newPy, c.stateGeom)) {
              c.px = newPx;
              c.py = newPy;
            } else {
              // If new position is outside polygon, try smaller steps
              const steps = 5;
              let validFound = false;
              for (let step = 1; step <= steps; step++) {
                const testPx = c.px + (c.vx * step / steps);
                const testPy = c.py + (c.vy * step / steps);
                const clampedX = Math.max(c.stateBounds.x0 + padX, Math.min(c.stateBounds.x1 - padX, testPx));
                const clampedY = Math.max(c.stateBounds.y0 + padY, Math.min(c.stateBounds.y1 - padY, testPy));
                
                if (isPointInState(clampedX, clampedY, c.stateGeom)) {
                  c.px = clampedX;
                  c.py = clampedY;
                  validFound = true;
                  break;
                }
              }
              
              // If no valid position found, stay at current position
              if (!validFound) {
                c.vx = 0;
                c.vy = 0;
              }
            }
          });
          
          // Damping
          companies.forEach(c => {
            c.vx *= 0.85;
            c.vy *= 0.85;
          });
        }
        
        // Final pass: gently resolve remaining overlaps while ensuring polygon containment
        const minSpacingFinal = 10;
        for (let i = 0; i < companies.length; i++) {
          const current = companies[i];
          let maxPushAttempts = 40; // Reduced attempts to avoid excessive pushing
          
          const padX = current.stateBounds.width * 0.12;
          const padY = current.stateBounds.height * 0.12;
          
          for (let attempt = 0; attempt < maxPushAttempts; attempt++) {
            let hasOverlap = false;
            
            for (let j = 0; j < companies.length; j++) {
              if (i === j) continue;
              
              const other = companies[j];
              const dx = current.px - other.px;
              const dy = current.py - other.py;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const minDist = current.radius + other.radius + minSpacingFinal;
              
              if (dist < minDist && dist > 0.1) {
                hasOverlap = true;
                
                // Gentle push away from overlap
                const angle = Math.atan2(dy, dx);
                const pushDist = (minDist - dist) * 0.4; // Gentler push
                let newPx = current.px + Math.cos(angle) * pushDist;
                let newPy = current.py + Math.sin(angle) * pushDist;
                
                // Clamp to bounding box
                newPx = Math.max(current.stateBounds.x0 + padX, Math.min(current.stateBounds.x1 - padX, newPx));
                newPy = Math.max(current.stateBounds.y0 + padY, Math.min(current.stateBounds.y1 - padY, newPy));
                
                // Only apply push if it keeps us in the actual polygon
                if (isPointInState(newPx, newPy, current.stateGeom)) {
                  current.px = newPx;
                  current.py = newPy;
                } else {
                  // Try moving only in X or Y direction
                  const testPxOnly = Math.max(current.stateBounds.x0 + padX, 
                                             Math.min(current.stateBounds.x1 - padX, newPx));
                  if (isPointInState(testPxOnly, current.py, current.stateGeom)) {
                    current.px = testPxOnly;
                  } else {
                    const testPyOnly = Math.max(current.stateBounds.y0 + padY, 
                                               Math.min(current.stateBounds.y1 - padY, newPy));
                    if (isPointInState(current.px, testPyOnly, current.stateGeom)) {
                      current.py = testPyOnly;
                    }
                  }
                }
              }
            }
            
            if (!hasOverlap) break;
          }
          
          // Final verification: ensure within polygon
          if (!isPointInState(current.px, current.py, current.stateGeom)) {
            // Try to find nearest valid point towards center
            const centerX = current.stateBounds.centerX;
            const centerY = current.stateBounds.centerY;
            let found = false;
            
            for (let step = 0.1; step <= 1; step += 0.1) {
              const testX = current.px + (centerX - current.px) * step;
              const testY = current.py + (centerY - current.py) * step;
              if (isPointInState(testX, testY, current.stateGeom)) {
                current.px = testX;
                current.py = testY;
                found = true;
                break;
              }
            }
            
            // If still not found, use centroid
            if (!found) {
              const centroid = path.centroid(current.stateGeom);
              if (centroid && isFinite(centroid[0]) && isFinite(centroid[1])) {
                current.px = centroid[0];
                current.py = centroid[1];
              }
            }
          }
          
          adjusted.push({
            ...current,
            finalX: current.px,
            finalY: current.py
          });
        }
      });
      
      return adjusted;
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
      // Only US companies
      const usCompanies = companies.filter(c => (c.Country||"").trim().toLowerCase() === "united states");
      const data = usCompanies.map(c=>{
        let proj = null;
        if (isFinite(c.Longitude) && isFinite(c.Latitude)) {
          // Use constrained position to keep within state boundaries
          const stateName = pick(c, ["State"]);
          proj = constrainToState(c.Longitude, c.Latitude, stateName);
        }
        const mc = c.market_cap;
        const industry = pick(c, ["Industry"]);
        const category = getIndustryCategory(industry);
        return { ...c, px: proj?proj[0]:null, py: proj?proj[1]:null, mc, category };
      }).filter(d=>d.px!=null && d.py!=null && d.category!=null);
      console.log(`US companies in dataset: ${usCompanies.length}, rendered: ${data.length}`);

      // Apply collision detection to spread out buildings
      const adjustedData = resolveCollisions(data);

      const sel = gBuildings.selectAll("g.building").data(adjustedData, d=>d.Ticker);
      const enter = sel.enter().append("g").attr("class","building");
      enter.append("image").attr("class","building-icon");

      const all = enter.merge(sel);

      // Update event handlers based on zoom state
      all.on("mousemove", isStateZoomed ? (ev,d)=> showTip(ev, d) : null)
         .on("mouseleave", isStateZoomed ? hideTip : null)
         .on("click", isStateZoomed ? (ev, d) => {
           try { showCompanyPopup(ev, d); } catch (e) {}
           try {
             const payload = { Ticker: d.Ticker, Name: d.Name, Address: d.Address, State: d.State };
             if (window.parent && window.parent !== window) {
               window.parent.postMessage({ type: 'companyClick', data: payload }, '*');
             }
           } catch (e) {}
           ev.stopPropagation();
         } : null);

      // Disable pointer events & hover visuals when not zoomed
      all.style("pointer-events", isStateZoomed ? "auto" : "none")
         .classed("building-interactive", isStateZoomed);

      // Keep icons at same on-screen size during zoom, use adjusted positions
      all.attr("transform", d => `translate(${d.finalX},${d.finalY}) scale(${1/currentZoom})`);

      all.each(function(d){
        const g = d3.select(this);
        const icon = industryIcons[d.category];
        if (!icon) return;
        
        // Use pre-calculated size from collision detection
        const size = d.size || 30;
        
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

    // Lightweight toggle of interactivity without recomputing positions (avoids delay on zoom)
    function updateBuildingInteractivity(enabled){
      gBuildings.selectAll("g.building")
        .on("mousemove", enabled ? (ev,d)=> showTip(ev, d) : null)
        .on("mouseleave", enabled ? hideTip : null)
        .on("click", enabled ? (ev, d) => {
          try { showCompanyPopup(ev, d); } catch (e) {}
          try {
            const payload = { Ticker: d.Ticker, Name: d.Name, Address: d.Address, State: d.State };
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'companyClick', data: payload }, '*');
            }
          } catch (e) {}
          ev.stopPropagation();
        } : null)
        .style("pointer-events", enabled ? "auto" : "none")
        .classed("building-interactive", enabled);
    }

    // ---- Tooltip (closer + clamped) ----
    function showTip(event, d){
      const mc = d.mc ? d3.format(".2s")(d.mc) : "n/a";
      const rating = d.employee_rating!=null ? d3.format(".2f")(d.employee_rating) : "n/a";
      const ceo    = d.ceo_approval!=null ? d3.format(".0f")(d.ceo_approval) + "%" : "n/a";
      const industry = pick(d, ["Industry"]) || "n/a";
      const sector = pick(d, ["Sector"]) || "n/a";
      const state = pick(d, ["State"]) || "";
      const address = d.Address || "";
      const fullAddress = address && state ? `${address}, ${state}` : (address || state);

      tooltip.html(`
        <div><strong>${d.Name || d.Ticker}</strong></div>
        <div>${fullAddress}</div>
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
      const foreign = companies.filter(c => (c.Country||"").trim().toLowerCase() !== "united states" && (c.Country||"").trim()!="");
      const byCountry = d3.group(foreign, d=>d.Country);
      const countries = Array.from(byCountry.keys()).sort();
      // 2-column grid layout for country circles
      const numCols = 2;
      const numRows = Math.ceil(countries.length / numCols);
      const colWidth = 120;
      const rowHeight = 110;
      const gridHeight = numRows * rowHeight;
      // Move circles closer to the map
      const startX = mapW; // reduced from +40 to +10
      const startY = Math.max(40, (mapH - gridHeight) / 2) + 30;
      
      // Compute positions for each country
      const data = countries.map((c, i) => {
        let col = i % numCols;
        let row = Math.floor(i / numCols);
        // If odd number and last item, center it
        if (countries.length % 2 === 1 && i === countries.length - 1) {
          col = 0.5; // center between columns
        }
        return {
          name: c,
          items: byCountry.get(c),
          i,
          col,
          row,
        };
      });
      
      const groups = gForeign.selectAll("g.country").data(data, d=>d.name);
      const enter = groups.enter().append("g").attr("class","country");
      enter.append("circle").attr("class","country-circle");
      enter.append("text").attr("class","country-label");
      
      const all = enter.merge(groups);
      all.attr("transform", d => {
        let x = startX + (d.col === 0.5 ? colWidth/2 : d.col * colWidth);
        let y = startY + d.row * rowHeight;
        return `translate(${x}, ${y})`;
      });
      
      all.select("circle.country-circle")
        .attr("r", d => 26 + Math.sqrt(d.items.length)*3)
        .style("cursor", "pointer")
        .on("click", (event, d) => onCountryClick(event, d, startX, startY, rowHeight));
      all.select("text.country-label")
        .attr("y", d => -(26 + Math.sqrt(d.items.length)*3) - 8)
        .text(d => d.name);
      
      // Mini buildings inside circle (update on every control change)
      all.each(function(d){
        const g = d3.select(this);
        const n = d.items.length;
        const R = 26 + Math.sqrt(n)*3;
        const bSel = g.selectAll("g.mini-building").data(d.items, dd=>dd.Ticker);
        const bEnter = bSel.enter().append("g").attr("class","mini-building");
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

      const stateName = d.properties.name;
      currentSelectedState = stateName;
      isStateZoomed = true; // Enable company interactions
      updateStateCompaniesPanel(stateName);
      // Just toggle handlers; avoid expensive re-render to remove delay
      updateBuildingInteractivity(true);
      showStatePanel();

      const b = path.bounds(d);
      const dx = b[1][0] - b[0][0];
      const dy = b[1][1] - b[0][1];
      const s  = Math.min(8, 0.9 / Math.max(dx / mapW, dy / mapH));
      const tx = mapW/2 - s * (b[0][0] + b[1][0]) / 2;
      const ty = mapH/2 - s * (b[0][1] + b[1][1]) / 2;

      // Smooth animated zoom using interpolated transforms
      const endTransform = `translate(${tx},${ty}) scale(${s})`;
      currentZoom = s;

      // Smooth zoom using single transform interpolation (shorter duration, easing out)
      gRoot.transition().duration(680).ease(d3.easeCubicOut)
        .attrTween("transform", () => d3.interpolateString(gRoot.attr("transform") || "translate(0,0) scale(1)", endTransform))
        .on("end", ()=>{ zoomTarget = {type:"state", id}; });

      // Counter-scale buildings (no expensive interpolation needed)
      gBuildings.selectAll("g.building")
        .transition().duration(680).ease(d3.easeCubicOut)
        .attr("transform", d => `translate(${d.finalX},${d.finalY}) scale(${1/currentZoom})`);

      gForeign.selectAll("g.mini-building")
        .transition().duration(680).ease(d3.easeCubicOut)
        .attr("transform", function(){
          const tStr = d3.select(this).attr("transform") || "";
          const translated = tStr.replace(/scale\([^)]*\)/g,"");
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
      const cy = startY + d.row * vSpacing;
      const r = 26 + Math.sqrt(d.items.length) * 3;
      // Calculate zoom: center on circle with some padding
      const padding = 80; // extra space around the circle
      const s = Math.min(8, Math.min(mapW / (2*r + padding), mapH / (2*r + padding)));
      const tx = mapW/2 - s * cx;
      const ty = mapH/2 - s * cy;
      currentZoom = s;
      const startTransform = gRoot.attr("transform") || "translate(0,0) scale(1)";
      const endTransform = `translate(${tx},${ty}) scale(${s})`;
      const tr = d3.transition().duration(950).ease(d3.easeCubicInOut);
      gRoot.transition(tr)
        .attrTween("transform", () => d3.interpolateString(startTransform, endTransform))
        .on("end", ()=>{ zoomTarget = {type:"country", id}; });
      gBuildings.selectAll("g.building")
        .transition(tr)
        .attrTween("transform", function(d){
          const start = d3.select(this).attr("transform") || `translate(${d.finalX},${d.finalY}) scale(${1/currentZoom})`;
          const target = `translate(${d.finalX},${d.finalY}) scale(${1/currentZoom})`;
          return d3.interpolateString(start, target);
        });
      gForeign.selectAll("g.mini-building")
        .transition(tr)
        .attrTween("transform", function(){
          const raw = d3.select(this).attr("transform") || "";
          const translated = raw.replace(/scale\([^)]*\)/g,"");
          const start = raw;
          const target = `${translated} scale(${1/currentZoom})`;
          return d3.interpolateString(start, target);
        });
      // Show company bar chart for selected country
      updateStateCompaniesPanel(d.name);
      showStatePanel();
    }

    function resetView(){
      gStates.selectAll(".state").classed("state-active", false);
      gForeign.selectAll("circle.country-circle").classed("country-circle-active", false);
      currentZoom = 1;
      currentSelectedState = null;
      isStateZoomed = false; // Disable company interactions
      statePanelTitle.text("Select a State");
      barChartContainer.html("");
      
      // Toggle handlers off (no full re-render for performance)
      updateBuildingInteractivity(false);
      hideStatePanel();
      gRoot.transition().duration(600).ease(d3.easeCubicOut)
        .attrTween("transform", ()=> d3.interpolateString(gRoot.attr("transform") || "translate(0,0) scale(1)", "translate(0,0) scale(1)"));

      gBuildings.selectAll("g.building")
        .transition().duration(600).ease(d3.easeCubicOut)
        .attr("transform", d => `translate(${d.finalX},${d.finalY}) scale(1)`);

      gForeign.selectAll("g.mini-building")
        .transition().duration(600).ease(d3.easeCubicOut)
        .attr("transform", function(){
          const tStr = d3.select(this).attr("transform") || "";
          const translated = tStr.replace(/scale\([^)]*\)/g,"");
          return `${translated} scale(1)`;
        });
      zoomTarget = null;
    }

    // Panel show/hide helpers
    function showStatePanel(){ if(layoutEl) layoutEl.classList.add('panel-open'); }
    function hideStatePanel(){ if(layoutEl) layoutEl.classList.remove('panel-open'); }

    // ---- Update State Companies Panel ----
    function updateStateCompaniesPanel(stateName) {
      statePanelTitle.text(stateName);
      
      // Get companies in this state or country
      let stateCompanies = [];
      // If the name matches a US state or abbreviation, filter by state
      const stateAbbr = stateNameToAbbr[stateName] || stateName;
      const isState = Object.keys(stateNameToAbbr).includes(stateName) || Object.values(stateNameToAbbr).includes(stateName);
      if (isState) {
        stateCompanies = companies.filter(c => {
          const cState = pick(c, ["State"]);
          return cState === stateName || cState === stateAbbr;
        });
      } else {
        // Otherwise, treat as country
        stateCompanies = companies.filter(c => {
          const cCountry = pick(c, ["Country"]);
          return cCountry === stateName;
        });
      }
      stateCompanies = stateCompanies.map(c => ({
        ...c,
        mc: getMarketCap(c.Ticker)
      })).filter(c => c.mc && c.mc > 0);
      
      if (stateCompanies.length === 0) {
        barChartContainer.html('');
        return;
      }

      // Bar chart scaling for market cap
      const mcValues = stateCompanies.map(d => d.mc).filter(v => v > 0);
      const maxMc = mcValues.length ? d3.max(mcValues) : 1;
      const heightScale = d3.scaleLinear()
        .domain([0, maxMc])
        .range([20, 260]); // Increased range for more prominent bars

      // Create bar chart items (declare and use only once)
      const items = barChartContainer.selectAll(".company-bar-item")
        .data(stateCompanies, d => d.Ticker);
      items.exit().remove();
      const itemsEnter = items.enter()
        .append("div")
        .attr("class", "company-bar-item");
      itemsEnter.append("img").attr("class", "company-logo");
      itemsEnter.append("div").attr("class", "bar-building");
      itemsEnter.append("div").attr("class", "company-name");
      itemsEnter.append("div").attr("class", "market-cap-label");
      const allItems = itemsEnter.merge(items);

      // Set logo src and handle errors
      // Calculate dynamic bar width based on number of companies and container width
      const minBarWidth = 32;
      const maxBarWidth = 80;
      const containerW = barChartContainer.node().offsetWidth || 800;
      let barWidth = Math.max(minBarWidth, Math.min(maxBarWidth, Math.floor(containerW / stateCompanies.length)));

      allItems.style("display", "inline-block")
        .style("vertical-align", "bottom")
        .style("width", `${barWidth}px`);

      allItems.select(".company-logo")
        .attr("src", d => `dataset/logos/images/${d.Ticker}.png`)
        .attr("alt", d => d.Name || d.Ticker)
        .style("display", "block")
        .style("height", "auto")
        .each(function(d, i) {
          // Scale logo width to match bar width
          const minLogo = 18;
          const maxLogo = 48;
          let logoW = Math.max(minLogo, Math.min(maxLogo, barWidth * 0.8));
          d3.select(this)
            .style("width", `${logoW}px`)
            .style("max-width", `${maxLogo}px`)
            .style("margin", "0 auto");
        })
        .on("error", function(event, d) {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#2a73d6';
          ctx.fillRect(0, 0, 32, 32);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(d.Ticker.substring(0, 4), 16, 16);
          d3.select(this).attr("src", canvas.toDataURL());
        });
      allItems.select(".company-name")
        .text(d => d.Name || d.Ticker);
      allItems.select(".bar-building")
        .style("height", "0px")
        .transition()
        .duration(1000)
        .delay((d, i) => i * 60)
        .ease(d3.easeCubicOut)
        .style("height", d => `${heightScale(Math.max(d.mc, maxMc * 0.01))}px`);
      allItems.select(".market-cap-label")
        .text(d => `$${d3.format(".2s")(d.mc)}`);

      // Always show companies horizontally, with scroll if needed
      barChartContainer.style("white-space", "nowrap")
        .style("overflow-x", "auto")
        .style("overflow-y", "hidden")
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "flex-end")
        .style("max-width", barChartContainer.node().offsetWidth + "px");
      allItems.style("display", "inline-block")
        .style("vertical-align", "bottom")
        .style("width", "80px");

      // Slide in animation for bar chart
      barChartContainer.style("transform", "translateX(60px)").style("opacity", "0");
      setTimeout(() => {
        barChartContainer.transition()
          .duration(400)
          .style("transform", "translateX(0)")
          .style("opacity", "1");
      }, 50);
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