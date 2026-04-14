# FunnelScope

FunnelScope is a complete funnel analytics SaaS dashboard built with Node.js, Express, MongoDB, and Vanilla JS. It uses a rule-based internal analysis engine, stores every run in MongoDB, renders a bar-style funnel and Chart.js pie chart, and compares the current funnel against saved history.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- Vanilla HTML, CSS, and JS
- Chart.js served locally from `node_modules`
- Internal rule engine only, with no external AI APIs

## Features

- Funnel input editor with 2-8 steps
- Rule-based "smart" analysis for conversion, leaks, and optimization suggestions
- Dark SaaS dashboard UI with neon green accents
- Horizontal funnel bars with leak highlighting
- Pie chart for conversion vs drop-off
- Saved analysis history in MongoDB
- Compare current funnel against any saved analysis
- One-click "Analyze with Past" flow against the latest saved run

## API Endpoints

### `POST /analyze`

```json
{
  "steps": [
    { "label": "Visitors", "value": 24000 },
    { "label": "Signup", "value": 1800 },
    { "label": "Paid", "value": 220 },
    { "label": "Retained", "value": 160 }
  ]
}
```

Returns the saved analysis payload, including:

- normalized `steps`
- `stepMetrics` with bar widths and drop percentages
- `metrics` for top-of-funnel, conversion rate, biggest drop, and worst step
- `insights` narrative
- `summary` with recommendations and alerts

### `GET /analysis/history`

Returns the latest 20 analyses sorted newest first.

### `POST /analysis/compare`

```json
{
  "currentSteps": [
    { "label": "Visitors", "value": 26000 },
    { "label": "Signup", "value": 2400 },
    { "label": "Paid", "value": 310 }
  ],
  "previousId": "ANALYSIS_DOCUMENT_ID"
}
```

Returns per-step changes, conversion delta, and side-by-side previous/current summaries.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```powershell
Copy-Item .env.example .env
```

3. Configure your environment variables:

```env
PORT=3000
MONGO_URI=your_mongodb_connection
JWT_SECRET=random_secret
```

4. Start the app:

```bash
node src/server.js
```

5. Open [https://funnelscope.onrender.com/](https://funnelscope.onrender.com/)

## Notes

- The server validates `MONGO_URI` and `JWT_SECRET` at startup.
- Chart.js is served locally from `/vendor/chart.js`, so the dashboard does not rely on a CDN.
- History and compare features require a working MongoDB connection because each analysis is saved before being rendered.
- If you use MongoDB Atlas, make sure your current IP is allowed by the cluster network access list.
