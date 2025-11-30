# Manual Implementation Guide: Industry Filter

Follow these 4 steps to implement the industry filter and fix the "Assignment to constant variable" error.

## Step 1: Add CSS Styles
Open `css/style.css` and add this code at the end of the file:

```css
/* Industry Filter Dropdown in Legend */
.legend-filter-content {
    margin: 12px 0;
    padding: 0 8px;
}

.industry-filter-select {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--grid);
    border-radius: 6px;
    color: var(--fg);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.industry-filter-select:hover {
    border-color: var(--accent);
}

.industry-filter-select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(94, 168, 255, 0.2);
}

.legend-panel.collapsed .legend-filter-content {
    display: none;
}
```

## Step 2: Add the Filter Variable
Open `js/mapvis.js`. Near the top of the `initVis` function (around line 180), add this variable:

```javascript
    // 1  -> icons grow fully with the map zoom
    const BUILDING_ZOOM_FACTOR = 0.6;

    // ADD THIS LINE:
    let selectedIndustryFilter = 'all'; 
```

## Step 3: Update `renderLegend` Function
In `js/mapvis.js`, find the `renderLegend()` function (around line 384) and replace the **entire function** with this code:

```javascript
    function renderLegend() {
      try {
        const panel = document.getElementById('legend-panel');
        if (!panel) return;
        const collapsed = panel.classList.contains('collapsed');
        panel.innerHTML = '';
        
        // Header
        const headerRow = document.createElement('div');
        headerRow.className = 'legend-header-row';
        const title = document.createElement('div');
        title.className = 'legend-panel-title';
        title.textContent = 'Industry Filter';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'legend-toggle';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'legend-toggle-icon';
        iconSpan.textContent = '▾';
        toggle.appendChild(iconSpan);
        headerRow.appendChild(title);
        headerRow.appendChild(toggle);
        
        // Filter Dropdown
        const filterContent = document.createElement('div');
        filterContent.className = 'legend-filter-content';
        
        const select = document.createElement('select');
        select.id = 'industry-filter-select';
        select.className = 'industry-filter-select';
        
        // "All Industries" option
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Industries';
        if (selectedIndustryFilter === 'all') allOption.selected = true;
        select.appendChild(allOption);
        
        // Industry options
        const cats = Object.keys(industryMapping || {});
        cats.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat;
          option.textContent = cat;
          if (selectedIndustryFilter === cat) option.selected = true;
          select.appendChild(option);
        });
        
        filterContent.appendChild(select);
        
        // Legend Grid
        const grid = document.createElement('div');
        grid.className = 'legend-grid';
        cats.forEach(cat => {
          const item = document.createElement('div');
          item.className = 'legend-item';
          const img = document.createElement('img');
          img.className = 'legend-item-icon';
          const icon = industryIcons[cat];
          img.src = icon ? icon.src : `dataset/building-icons/${cat}.png`;
          img.alt = cat;
          const label = document.createElement('span');
          label.className = 'legend-item-label';
          label.textContent = cat;
          item.appendChild(img);
          item.appendChild(label);
          grid.appendChild(item);
        });
        
        panel.appendChild(headerRow);
        panel.appendChild(filterContent);
        panel.appendChild(grid);
        
        if (collapsed) {
          panel.classList.add('collapsed');
        }
        
        // Event Listeners
        select.addEventListener('change', (ev) => {
          selectedIndustryFilter = ev.target.value;
          render(); // Re-render map
        });
        
        panel.addEventListener('click', (ev) => ev.stopPropagation());
        headerRow.addEventListener('click', (ev) => {
          ev.stopPropagation();
          panel.classList.toggle('collapsed');
        });
        toggle.addEventListener('click', (ev) => {
          ev.stopPropagation();
          panel.classList.toggle('collapsed');
        });
        
        positionLegendPanel();
      } catch (e) { }
    }
```

## Step 4: Fix `renderBuildings` (The Critical Fix)
In `js/mapvis.js`, find the `renderBuildings()` function (around line 800).

You need to change `const data` to `let data` and add the filter logic. Replace the beginning of the function with this:

```javascript
    // ---- Buildings (icons for US companies) ----
    function renderBuildings() {
      // Only US companies
      const usCompanies = companies.filter(c => (c.Country || "").trim().toLowerCase() === "united states");
      
      // CHANGE 'const' TO 'let' HERE:
      let data = usCompanies.map(c => {
        let proj = null;
        if (isFinite(c.Longitude) && isFinite(c.Latitude)) {
          // Use constrained position to keep within state boundaries
          const stateName = pick(c, ["State"]);
          proj = constrainToState(c.Longitude, c.Latitude, stateName);
        }
        const mc = c.market_cap;
        const industry = pick(c, ["Industry"]);
        const category = getIndustryCategory(industry);
        return { ...c, px: proj ? proj[0] : null, py: proj ? proj[1] : null, mc, category };
      }).filter(d => d.px != null && d.py != null && d.category != null);

      // INSERT FILTER LOGIC HERE:
      if (selectedIndustryFilter !== 'all') {
        data = data.filter(d => d.category === selectedIndustryFilter);
      }

      console.log(`US companies in dataset: ${usCompanies.length}, rendered: ${data.length}`);

      // ... rest of the function remains the same (collision detection, etc.)
```
