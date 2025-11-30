# Manual Implementation Guide: Dynamic Legend & Opacity

Follow these steps to make the legend label show the actual min/max ratings and map the rating to the building's opacity.

## Step 1: Add an ID to the Legend Label
Open `js/mapvis.js` and find the `controlsHTML` string inside `updateStateCompaniesPanel` (around line 1320).

Find this line:
```html
<span class="chart-legend-label">Color = Employee Rating (Orange→Green)</span>
```

**Replace it with this line** (adding an ID so we can update it later):
```html
<span id="rating-legend-label" class="chart-legend-label">Color = Employee Rating</span>
```

## Step 2: Update the Label Text Dynamically
Scroll down to where `ratingDomain` is defined (around line 1418).

**Add this code immediately after `const midRating = ...;`**:

```javascript
      const ratingDomain = ratingVals.length ? d3.extent(ratingVals) : [0, 5];
      const midRating = (ratingDomain[0] + ratingDomain[1]) / 2;

      // --- ADD THIS BLOCK ---
      const minRatingStr = d3.format(".1f")(ratingDomain[0]);
      const maxRatingStr = d3.format(".1f")(ratingDomain[1]);
      const labelEl = document.getElementById('rating-legend-label');
      if (labelEl) {
        labelEl.textContent = `Color = Employee Rating (${minRatingStr} - ${maxRatingStr})`;
      }
      // ----------------------
```

## Step 3: Apply Opacity to Buildings
Scroll down to where the building bars are styled (around line 1495).

Look for the `.style("background", ...)` block. **Add the opacity style right after it**:

```javascript
        .style("background", d => {
          const r = d.employee_rating;
          const base =
            r != null && isFinite(r)
              ? colorScale(r)
              : colorScale(midRating);
          // darker bottom for depth
          const bottom = d3.interpolateRgb(base, "#0b2648")(0.7);
          return `linear-gradient(180deg, ${base}, ${bottom})`;
        })
        // --- ADD THIS OPACITY STYLE ---
        .style("opacity", d => {
           const r = d.employee_rating;
           if (r == null || !isFinite(r)) return 0.5;
           // Map rating to opacity: Min rating = 0.4 opacity, Max rating = 1.0 opacity
           const min = ratingDomain[0] || 0;
           const max = ratingDomain[1] || 5;
           if (max === min) return 1;
           // Normalize rating between 0 and 1
           const t = (r - min) / (max - min);
           // Scale to 0.4 - 1.0 range
           return 0.4 + (t * 0.6); 
        })
        // -----------------------------
        .style("border", "2px solid #5ea8ff")
```

## Summary
1.  **Step 1** gives the legend label an ID so JavaScript can find it.
2.  **Step 2** calculates the text "3.0 - 4.5" and updates the label.
3.  **Step 3** makes buildings with lower ratings more transparent (0.4 opacity) and higher ratings more solid (1.0 opacity).
