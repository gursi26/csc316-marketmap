import pandas as pd
import plotly.graph_objects as go
import numpy as np
from dash import Dash, dcc, html, dash_table, Input, Output

salaries = pd.read_csv("../levels/salaries.csv")
nasdaq_data = pd.read_csv("../nasdaq100_snapshot.csv")
pd.set_option('display.max_columns', None)

# Join employee count data with salaries data
salaries_with_employees = salaries.merge(
    nasdaq_data[['Ticker', 'Full-Time Employees']], 
    left_on='company ticker', 
    right_on='Ticker', 
    how='left'
)
# Fill missing employee counts with 1 to avoid division by zero
salaries_with_employees['Full-Time Employees'] = salaries_with_employees['Full-Time Employees'].fillna(1)

# Filter for software-engineer roles
se_df = salaries_with_employees[salaries_with_employees['role name'] == 'software-engineer']

# Data cleaning: only keep companies with contiguous role ranks starting from 1, and only for rows with non-empty total pay
cleaned = []
for company, group in se_df.groupby('company name'):
    # Only consider rows with non-empty total pay (USD)
    group_with_pay = group[group['total pay (USD)'].notnull() & (group['total pay (USD)'] != '')]
    group_sorted = group_with_pay.sort_values('role rank')
    ranks = group_sorted['role rank'].dropna().astype(int).values
    if len(ranks) == 0:
        continue
    if ranks.min() != 1:
        continue
    expected = np.arange(1, ranks.max() + 1)
    if np.array_equal(ranks, expected):
        cleaned.append((company, group_sorted))

# Prepare the plotly figure (Viz 1)
fig = go.Figure()
for company, group_sorted in cleaned:
    fig.add_trace(go.Scatter(
        x=group_sorted['role rank'],
        y=group_sorted['total pay (USD)'],
        mode='lines+markers',
        name=company
    ))
    # Add company name as text at the last point, offset to the right
    if not group_sorted.empty:
        last_row = group_sorted.iloc[-1]
        offset_x = last_row['role rank'] + 0.05  # small offset to the right
        fig.add_trace(go.Scatter(
            x=[offset_x],
            y=[last_row['total pay (USD)']],
            text=[company],
            mode='text',
            textposition='middle right',
            showlegend=False,
            textfont=dict(size=8, color='black'),
            hoverinfo='skip',
        ))

fig.update_layout(
    title='Software Engineer Pay Progression by Company',
    xaxis_title='Role Rank',
    yaxis_title='Total Pay (USD)',
    legend_title='Company',
    template='plotly_white',
    margin=dict(l=0, r=0, t=60, b=0),
    autosize=True,
    height=700,
)

# --- Viz 2: Stacked bar for top 10 roles by frequency with pay breakdown ---
role_counts = salaries['role name'].value_counts()
top_roles = role_counts.head(10).index.tolist()
top_roles_df = salaries_with_employees[salaries_with_employees['role name'].isin(top_roles) & salaries_with_employees['total pay (USD)'].notnull() & (salaries_with_employees['total pay (USD)'] != '')]
top_roles_ordered = role_counts.head(10).index.tolist()

# For each role, compute weighted average min/max and weighted average pay breakdown
avg_min_pays = []
avg_max_pays = []
base_props = []
stock_props = []
bonus_props = []

for role in top_roles_ordered:
    role_data = top_roles_df[top_roles_df['role name'] == role]
    company_weights = []
    company_min_values = []
    company_max_values = []
    company_base_props = []
    company_stock_props = []
    company_bonus_props = []
    for company, company_group in role_data.groupby('company name'):
        company_salaries = company_group['total pay (USD)']
        if len(company_salaries) > 0:
            employee_count = company_group['Full-Time Employees'].iloc[0]
            company_weights.append(employee_count)
            company_min_values.append(company_salaries.min())
            company_max_values.append(company_salaries.max())
            # Pay breakdown sums
            base_sum = company_group['base pay (USD)'].fillna(0).sum()
            stock_sum = company_group['stock (USD)'].fillna(0).sum()
            bonus_sum = company_group['bonus (USD)'].fillna(0).sum()
            total_sum = company_group['total pay (USD)'].fillna(0).sum()
            if total_sum > 0:
                company_base_props.append(base_sum / total_sum)
                company_stock_props.append(stock_sum / total_sum)
                company_bonus_props.append(bonus_sum / total_sum)
            else:
                company_base_props.append(0)
                company_stock_props.append(0)
                company_bonus_props.append(0)
    if len(company_weights) > 0:
        total_weight = sum(company_weights)
        avg_min_pay = sum(w * min_val for w, min_val in zip(company_weights, company_min_values)) / total_weight
        avg_max_pay = sum(w * max_val for w, max_val in zip(company_weights, company_max_values)) / total_weight
        # Weighted average proportions
        avg_base_prop = sum(w * p for w, p in zip(company_weights, company_base_props)) / total_weight
        avg_stock_prop = sum(w * p for w, p in zip(company_weights, company_stock_props)) / total_weight
        avg_bonus_prop = sum(w * p for w, p in zip(company_weights, company_bonus_props)) / total_weight
        # Normalize to sum to 1 (in case of rounding)
        total_prop = avg_base_prop + avg_stock_prop + avg_bonus_prop
        if total_prop > 0:
            avg_base_prop /= total_prop
            avg_stock_prop /= total_prop
            avg_bonus_prop /= total_prop
        avg_min_pays.append(avg_min_pay)
        avg_max_pays.append(avg_max_pay)
        base_props.append(avg_base_prop)
        stock_props.append(avg_stock_prop)
        bonus_props.append(avg_bonus_prop)
    else:
        avg_min_pays.append(0)
        avg_max_pays.append(0)
        base_props.append(0)
        stock_props.append(0)
        bonus_props.append(0)

bar_heights = [max_v - min_v for min_v, max_v in zip(avg_min_pays, avg_max_pays)]
base_heights = [h * p for h, p in zip(bar_heights, base_props)]
stock_heights = [h * p for h, p in zip(bar_heights, stock_props)]
bonus_heights = [h * p for h, p in zip(bar_heights, bonus_props)]

rect_fig = go.Figure()
rect_fig.add_trace(go.Bar(
    x=top_roles_ordered,
    y=base_heights,
    base=avg_min_pays,
    name='Base',
    marker_color='mediumturquoise',
    text=[f"${min_v + base_h:,.0f}" for min_v, base_h in zip(avg_min_pays, base_heights)],
    textposition='none',
))
rect_fig.add_trace(go.Bar(
    x=top_roles_ordered,
    y=stock_heights,
    base=[min_v + base_h for min_v, base_h in zip(avg_min_pays, base_heights)],
    name='Stock',
    marker_color='gold',
    text=[f"${min_v + base_h + stock_h:,.0f}" for min_v, base_h, stock_h in zip(avg_min_pays, base_heights, stock_heights)],
    textposition='none',
))
rect_fig.add_trace(go.Bar(
    x=top_roles_ordered,
    y=bonus_heights,
    base=[min_v + base_h + stock_h for min_v, base_h, stock_h in zip(avg_min_pays, base_heights, stock_heights)],
    name='Bonus',
    marker_color='salmon',
    text=[f"${max_v:,.0f}" for max_v in avg_max_pays],
    textposition='outside',
    textfont=dict(size=12, color='black')
))
# Add min value at bottom
rect_fig.add_trace(go.Scatter(
    x=top_roles_ordered,
    y=avg_min_pays,
    text=[f"${min_v:,.0f}" for min_v in avg_min_pays],
    mode='text',
    textposition='bottom center',
    showlegend=False,
    textfont=dict(size=12, color='black'),
    hoverinfo='skip'
))
rect_fig.update_layout(
    barmode='stack',
    title='Salary Range by Role (Top 10 Most Frequent Roles) — Stacked by Pay Type',
    xaxis_title='Role Name',
    yaxis_title='Total Pay (USD)',
    template='plotly_white',
    margin=dict(l=0, r=0, t=80, b=60),
    autosize=True,
    height=800,
    xaxis=dict(tickangle=45),
    yaxis=dict(range=[0, None])
)

# --- Viz 3: Scatterplot of company rating vs CEO approval, dot size = employee count ---
glassdoor = pd.read_csv("../glassdoorData.csv")
nasdaq = pd.read_csv("../nasdaq100_snapshot.csv")
levels_map = pd.read_csv("../levels/nasdaq_100_levels.csv")

# Parse CEO approval as number
import re
def extract_ceo_approval(val):
    if isinstance(val, str):
        match = re.search(r"(\d+)", val)
        if match:
            return int(match.group(1))
    return None

glassdoor['CEOApproval'] = glassdoor['CEOApprovalPercentage'].apply(extract_ceo_approval)
# Ensure rating is numeric
glassdoor['Rating'] = pd.to_numeric(glassdoor['Rating'], errors='coerce')

# Join on ticker (Symbol <-> Ticker)
glassdoor['Symbol'] = glassdoor['Symbol'].str.strip()
nasdaq['Ticker'] = nasdaq['Ticker'].str.strip()
levels_map['Stock Ticker'] = levels_map['Stock Ticker'].astype(str).str.strip()

glassdoor_nasdaq = glassdoor.merge(
    nasdaq[['Ticker', 'Company', 'Full-Time Employees']],
    left_on='Symbol', right_on='Ticker', how='inner'
)
# Third join to bring in short slug company names from levels
joined = glassdoor_nasdaq.merge(
    levels_map[['Stock Ticker', 'Company Name']],
    left_on='Ticker', right_on='Stock Ticker', how='left'
)

# Decide which company label to use (prefer levels slug)
company_col = 'Company_x' if 'Company_x' in joined.columns else ('Company_y' if 'Company_y' in joined.columns else 'Company')
joined['label_name'] = joined['Company Name'].where(joined['Company Name'].notna() & (joined['Company Name'] != ''), joined[company_col])

# Prepare data for scatterplot: coerce employees to numeric and filter valid rows
scatter_df = joined.copy()
scatter_df['Full-Time Employees'] = pd.to_numeric(scatter_df['Full-Time Employees'], errors='coerce')
scatter_df = scatter_df.dropna(subset=['Rating', 'CEOApproval', 'Full-Time Employees'])
scatter_df = scatter_df[scatter_df['Full-Time Employees'] > 0]

viz3_fig = go.Figure()
if not scatter_df.empty and scatter_df['Full-Time Employees'].max() > 0:
    max_emp = scatter_df['Full-Time Employees'].max()
    viz3_fig.add_trace(go.Scatter(
        x=scatter_df['Rating'],
        y=scatter_df['CEOApproval'],
        mode='markers+text',
        text=scatter_df['label_name'],
        textposition='top center',
        textfont=dict(size=8, color='black'),
        marker=dict(
            size=(scatter_df['Full-Time Employees'] / max_emp) * 60 + 6,  # scaled size
            sizemode='diameter',
            sizemin=6,
            color='mediumturquoise',
            opacity=0.7,
            line=dict(width=1, color='black')
        ),
        customdata=scatter_df['Full-Time Employees'],
        hovertemplate='<b>%{text}</b><br>Rating: %{x}<br>CEO Approval: %{y}%<br>Employees: %{customdata:,.0f}<extra></extra>'
    ))
    viz3_fig.update_layout(
        title='Company Rating vs CEO Approval (Dot Size = Employee Count)',
        xaxis_title='Glassdoor Company Rating',
        yaxis_title='CEO Approval Percentage',
        template='plotly_white',
        margin=dict(l=0, r=0, t=80, b=60),
        autosize=True,
        height=700,
    )
else:
    viz3_fig.add_annotation(
        text='No data available for scatterplot.',
        xref='paper', yref='paper',
        x=0.5, y=0.5, showarrow=False,
        font=dict(size=20, color='red')
    )
    viz3_fig.update_layout(
        title='Company Rating vs CEO Approval (Dot Size = Employee Count)',
        template='plotly_white',
        autosize=True,
        height=300,
    )

# Dash app
app = Dash(__name__)

# Dropdown options
company_options = [{'label': c, 'value': c} for c in sorted(salaries_with_employees['company name'].dropna().unique())]
role_options = [{'label': r, 'value': r} for r in sorted(salaries_with_employees['role name'].dropna().unique())]

app.layout = html.Div([
    html.Div([
        html.Div([
            html.Label('Filter by Company:'),
            dcc.Dropdown(
                id='company-filter',
                options=company_options,
                multi=True,
                placeholder='Select company...'
            ),
        ], style={'width': '48%', 'display': 'inline-block', 'verticalAlign': 'top'}),
        html.Div([
            html.Label('Filter by Role Name:'),
            dcc.Dropdown(
                id='role-filter',
                options=role_options,
                multi=True,
                placeholder='Select role name...'
            ),
        ], style={'width': '48%', 'display': 'inline-block', 'marginLeft': '4%', 'verticalAlign': 'top'}),
    ], style={'marginBottom': 20, 'marginTop': 20, 'width': '100%'}),
    dash_table.DataTable(
        id='salary-table',
        columns=[{"name": i, "id": i} for i in salaries_with_employees.columns],
        data=salaries_with_employees.to_dict('records'),
        page_size=15,
        style_table={'overflowX': 'auto', 'width': '100vw'},
        style_cell={'textAlign': 'left', 'minWidth': '120px', 'maxWidth': '300px', 'whiteSpace': 'normal', 'backgroundColor': 'white', 'color': 'black'},
        style_header={'fontWeight': 'bold', 'backgroundColor': '#f0f0f0', 'color': 'black'},
        style_data={'backgroundColor': 'white', 'color': 'black'},
    ),
    html.Br(),
    dcc.Graph(figure=fig, style={"width": "100vw", "height": "700px"}),
    dcc.Graph(figure=rect_fig, style={"width": "100vw", "height": "800px"}),
    dcc.Graph(figure=viz3_fig, style={"width": "100vw", "height": "700px"}),
], style={"padding": 0, "margin": 0, "width": "100vw", "background": "#18191A"})

@app.callback(
    Output('salary-table', 'data'),
    [Input('company-filter', 'value'), Input('role-filter', 'value')]
)
def update_table(selected_companies, selected_roles):
    df = salaries_with_employees.copy()
    if selected_companies:
        df = df[df['company name'].isin(selected_companies)]
    if selected_roles:
        df = df[df['role name'].isin(selected_roles)]
    return df.to_dict('records')

if __name__ == "__main__":
    app.run(debug=True)