# Industry Filter Implementation Guide

## Overview
Convert the static industry legend into a dynamic filter dropdown that filters which companies are displayed on the map based on their industry category.

## Changes Required

### 1. Add Industry Filter Variable (add near top of initVis function, around line 180)
```javascript
// Track selected industry filter (default to 'all')
let selectedIndustryFilter = 'all';
```

### 2. Update renderLegend() Function (lines 384-442)

Replace the existing `renderLegend()` function with this updated version:

```javascript
function renderLegend() {
  try {
    const panel = document.getElementById('legend-panel');
    if (!panel) return;
    const collapsed = panel.classList.contains('collapsed');
    panel.innerHTML = '';
    const headerRow = document.createElement('div');
    headerRow.className = 'legend-header-row';
    const title = document.createElement('div');
    title.className = 'legend-panel-title';
    title.textContent = 'Industry Filter';  // Changed from "Legend"
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'legend-toggle';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'legend-toggle-icon';
    iconSpan.textContent = '▾';
    toggle.appendChild(iconSpan);
    headerRow.appendChild(title);
    headerRow.appendChild(toggle);
    
    // Create dropdown filter (NEW)
    const filterContent = document.createElement('div');
    filterContent.className = 'legend-filter-content';
    
    const select = document.createElement('select');
    select.id = 'industry-filter-select';
    select.className = 'industry-filter-select';
    
    // Add "All Industries" option as default
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Industries';
    allOption.selected = true;
    select.appendChild(allOption);
    
    // Add industry category options
    const cats = Object.keys(industryMapping || {});
    cats.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
    
    filterContent.appendChild(select);
    
    // Create legend grid for reference
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
    panel.appendChild(filterContent);  // Add filter dropdown
    panel.appendChild(grid);
    
    if (collapsed) {
      panel.classList.add('collapsed');
    }
    
    // Add change event listener to filter (NEW)
    select.addEventListener('change', (ev) => {
      selectedIndustryFilter = ev.target.value;
      render(); // Re-render with new filter
    });
    
    // Prevent clicks inside the panel from triggering global click handlers
    panel.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });
    // Allow clicking anywhere on the header to toggle
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

### 3. Update renderBuildings() Function (around line 762)

In the `renderBuildings()` function, after line 776 where it filters to get data, add this filtering logic:

```javascript
// After this existing line:
}).filter(d => d.px != null && d.py != null && d.category != null);

// Add industry filter
if (selectedIndustryFilter !== 'all') {
  data = data.filter(d => d.category === selectedIndustryFilter);
}

console.log(`US companies in dataset: ${usCompanies.length}, rendered: ${data.length}`);
```

So the complete section should look like:
```javascript
const data = usCompanies.map(c => {
  let proj = null;
  if (isFinite(c.Longitude) && isFinite(c.Latitude)) {
    const stateName = pick(c, ["State"]);
    proj = constrainToState(c.Longitude, c.Latitude, stateName);
  }
  const mc = c.market_cap;
  const industry = pick(c, ["Industry"]);
  const category = getIndustryCategory(industry);
  return { ...c, px: proj ? proj[0] : null, py: proj ? proj[1] : null, mc, category };
}).filter(d => d.px != null && d.py != null && d.category != null);

// Apply industry filter
if (selectedIndustryFilter !== 'all') {
  data = data.filter(d => d.category === selectedIndustryFilter);
}

console.log(`US companies in dataset: ${usCompanies.length}, rendered: ${data.length}`);
```

### 4. Add CSS for New Elements

Add to `style.css`:

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

## Summary of Changes:
1. Added `selectedIndustryFilter` variable to track the current filter state
2. Modified `renderLegend()` to create a dropdown select with "All Industries" as default
3. Added change event listener to the dropdown that calls `render()` when selection changes
4. Modified `renderBuildings()` to filter the data based on `selectedIndustryFilter`
5. Added CSS for the dropdown styling

## Result:
- Legend panel now shows "Industry Filter" instead of "Legend"
- Dropdown at top of panel allows selecting "All Industries" or a specific category
- When a specific industry is selected, only companies from that industry are shown on the map
- Default is "All Industries" showing all companies
- Icons grid still shows below the dropdown for reference
