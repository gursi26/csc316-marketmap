# Manual Implementation Guide: Employee Rating Color Scale

Follow these steps to change the employee rating color scale from "Red to Green" to "Orange to Green".

## Step 1: Locate the Color Scale Definition
Open `js/mapvis.js` and find the `updateStateCompaniesPanel` function.
Scroll down to approximately line **1421** (or search for `const colorScale = d3`).

You will see this code:
```javascript
      const colorScale = d3
        .scaleLinear()
        .domain([ratingDomain[0], midRating, ratingDomain[1]])
        .range(["#d64d4d", "#f0d34a", "#36b37e"]);
```

## Step 2: Update the Color Range
Replace that entire block with the following code. This changes the first color from Red (`#d64d4d`) to Orange (`#ff7b00`).

```javascript
      const colorScale = d3
        .scaleLinear()
        .domain([ratingDomain[0], midRating, ratingDomain[1]])
        // Changed start color from Red (#d64d4d) to Orange (#ff7b00)
        .range(["#ff7b00", "#f0d34a", "#36b37e"]);
```

## Step 3: Update the Legend Label (Optional but Recommended)
If you want the legend to match the new colors, scroll up to where the `controlsHTML` string is defined (around line **1300** inside the same function).

Find this line:
```html
<span class="chart-legend-label">Color = Employee Rating (Red→Green)</span>
```

And change it to:
```html
<span class="chart-legend-label">Color = Employee Rating (Orange→Green)</span>
```
