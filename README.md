# Azure App Service + Application Insights Lab

A hands-on learning lab for Azure logging with Node.js, App Service, and Application Insights.

## What You'll Learn

| Topic | Endpoint | Portal Location |
|-------|----------|-----------------|
| Application Logs | `/api/logs` | Logs → `traces` table |
| Exception Logs | `/api/error` | Failures → `exceptions` table |
| Request Tracing | `/api/users/:id` | Transaction search → `requests` |
| Performance Monitoring | `/api/metrics` | Metrics → `customMetrics` |

---

## Prerequisites

- Node.js 20+ or 24 LTS
- Azure account with active subscription
- Azure CLI installed (`az`)

---

## Quick Start (Local Development)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd appservice-lab
npm install
```

### 2. Set Environment Variable

```bash
# Windows CMD
set APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=YOUR-KEY;IngestionEndpoint=https://YOUR-REGION.in.applicationinsights.azure.com/

# Windows PowerShell
$env:APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=YOUR-KEY;IngestionEndpoint=https://YOUR-REGION.in.applicationinsights.azure.com/"

# Linux/Mac
export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=YOUR-KEY;IngestionEndpoint=https://YOUR-REGION.in.applicationinsights.azure.com/"
```

### 3. Run

```bash
npm start
```

App runs at: http://localhost:3000

---

## Deploy to Azure App Service

### Step 1: Create Application Insights

**Option A: Azure Portal (GUI)**

1. Go to https://portal.azure.com
2. Click **Create a resource** → search **"Application Insights"**
3. Fill in:
   - Resource Group: `June-RG` (or create new)
   - Name: `appinsights-lab`
   - Region: Choose your region
   - OTLP support: **On**
4. Click **Review + create** → **Create**
5. After deployment, click **Go to resource**
6. Copy the **Connection String** from Properties

**Option B: Azure CLI**

```bash
# Create resource group
az group create --name June-RG --location eastus

# Create Application Insights
az monitor app-insights component create \
  --app appinsights-lab \
  --location eastus \
  --resource-group June-RG \
  --application-type web

# Get connection string
az monitor app-insights component show \
  --app appinsights-lab \
  --resource-group June-RG \
  --query connectionString \
  --output tsv
```

---

### Step 2: Create App Service Plan

**Option A: Azure Portal (GUI)**

1. Click **Create a resource** → search **"App Service Plan"**
2. Fill in:
   - Resource Group: `June-RG`
   - Name: `appinsights-lab-plan`
   - Region: Same as Application Insights
   - Pricing: **Free F1** (for learning)
3. Click **Review + create** → **Create**

**Option B: Azure CLI**

```bash
az appservice plan create \
  --name appinsights-lab-plan \
  --resource-group June-RG \
  --sku F1 \
  --is-linux
```

---

### Step 3: Create Web App

**Option A: Azure Portal (GUI)**

1. Click **Create a resource** → search **"Web App"**
2. Fill in **Basics** tab:
   - Resource Group: `June-RG`
   - Name: `appinsights-lab-YOURNAME` (must be globally unique)
   - Publish: **Code**
   - Runtime stack: **Node.js 24 LTS**
   - Operating System: **Linux**
   - Region: Same as App Service Plan
   - Pricing: **Free F1**
3. Click **Next** through tabs until **Review + create**
4. Click **Create**
5. Wait for deployment, then click **Go to resource**

**Option B: Azure CLI**

```bash
az webapp create \
  --name appinsights-lab-YOURNAME \
  --resource-group June-RG \
  --plan appinsights-lab-plan \
  --runtime NODE:24-lts
```

---

### Step 4: Configure Environment Variables

**Option A: Azure Portal (GUI)**

1. Go to your Web App
2. Left menu → **Settings** → **Environment variables**
3. Click **+ Add**
4. Add these two settings:

| Name | Value |
|------|-------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `InstrumentationKey=YOUR-KEY;IngestionEndpoint=https://...` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

5. Click **OK** → **Apply** → **Confirm**

**Option B: Azure CLI**

```bash
az webapp config appsettings set \
  --name appinsights-lab-YOURNAME \
  --resource-group June-RG \
  --settings \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=YOUR-KEY;IngestionEndpoint=https://..." \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true"
```

---

### Step 5: Deploy Your Code

**Option A: Azure CLI (Recommended)**

```bash
# Create deployment zip
tar -a -c -f deployment.zip package.json src

# Deploy
az webapp deploy \
  --name appinsights-lab-YOURNAME \
  --resource-group June-RG \
  --src-path deployment.zip \
  --type zip
```

**Option B: Azure Portal (Kudu)**

1. Go to your Web App
2. Left menu → **Advanced Tools** → **Go**
3. Click **Debug console** → **CMD**
4. Navigate to `site` → `wwwroot`
5. Upload files:
   - `package.json`
   - `src/` folder (with `index.js` inside)
6. The app will restart automatically

**Option C: GitHub Actions (CI/CD)**

See [GitHub Actions Setup](#github-actions-setup) below.

---

### Step 6: Test Your Deployed App

Visit your app URL:
```
https://appinsights-lab-YOURNAME.azurewebsites.net/
```

Test endpoints:
```bash
# Health check
curl https://appinsights-lab-YOURNAME.azurewebsites.net/

# Application log
curl "https://appinsights-lab-YOURNAME.azurewebsites.net/api/logs?level=info&message=hello"

# Request tracing
curl https://appinsights-lab-YOURNAME.azurewebsites.net/api/users/123

# Custom metric
curl "https://appinsights-lab-YOURNAME.azurewebsites.net/api/metrics?value=42"
```

---

## View Telemetry in Azure Portal

### Live Metrics (Real-time)

1. Go to **Application Insights** resource
2. Click **Live Metrics** on the left menu
3. See requests flowing in real-time

### Logs (Historical)

1. Go to **Application Insights** → **Logs**
2. Run these KQL queries:

**All requests:**
```kql
requests
| where timestamp > ago(1h)
| project timestamp, name, resultCode, duration
| order by timestamp desc
```

**Application logs:**
```kql
traces
| where timestamp > ago(1h)
| project timestamp, message, severityLevel
| order by timestamp desc
```

**Exceptions:**
```kql
exceptions
| where timestamp > ago(1h)
| project timestamp, type, outerMessage
| order by timestamp desc
```

**Custom metrics:**
```kql
customMetrics
| where timestamp > ago(1h)
| project timestamp, name, value
| order by timestamp desc
```

### Performance

1. Go to **Application Insights** → **Performance**
2. See request duration percentiles
3. Drill into slow requests

### Failures

1. Go to **Application Insights** → **Failures**
2. See exception types and affected requests

---

## API Endpoints

| Method | Endpoint | Description | Learning Area |
|--------|----------|-------------|---------------|
| GET | `/` | Health check | Basic request |
| GET | `/api/logs?level=info&message=hello` | Log a message | Application Logs |
| POST | `/api/logs/batch` | Batch logging (body: `{"count": 10}`) | Application Logs |
| GET | `/api/error` | Throws unhandled error | Exception Logs |
| GET | `/api/error/handled` | Returns handled error | Exception Logs |
| GET | `/api/error/async` | Returns async error | Exception Logs |
| GET | `/api/users/:id` | Get user with tracing | Request Tracing |
| GET | `/api/orders` | Get orders with HTTP dependency | Request Tracing |
| GET | `/api/performance/slow?delay=2000` | Slow operation | Performance |
| GET | `/api/performance/memory?mb=50` | Memory allocation | Performance |
| GET | `/api/metrics?value=42` | Custom metric | Performance |

---

## GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure Web App

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: appinsights-lab-YOURNAME
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

### Get Publish Profile

1. Go to your Web App in Azure Portal
2. Click **Get publish profile** (top menu)
3. Download the `.PublishSettings` file
4. In GitHub repo → Settings → Secrets → Actions
5. Create secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
6. Paste the contents of the `.PublishSettings` file

---

## Project Structure

```
appservice-lab/
├── src/
│   └── index.js          # Main Express app with all endpoints
├── package.json          # Dependencies and scripts
├── .gitignore           # Git ignore rules
├── PORTAL-QUERIES.md    # KQL queries reference
└── README.md            # This file
```

---

## Troubleshooting

### App shows 403 Forbidden

This usually means the app failed to start. Check:

1. Go to Web App → **Advanced Tools** → **Go**
2. Click **Debug console** → **CMD**
3. Navigate to `site` → `wwwroot`
4. Check if `package.json` and `src/index.js` exist
5. Check logs in `LogFiles` folder

### No telemetry appearing

1. Verify connection string is set in Environment variables
2. Check the app shows `insights_enabled: true` on the health check endpoint
3. Wait 2-5 minutes for telemetry to appear
4. Check Live Metrics - data appears faster there

### App fails to start

1. Check deployment logs:
   ```bash
   az webapp log tail --name appinsights-lab-YOURNAME --resource-group June-RG
   ```
2. Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is set
3. Check Node.js version compatibility (use 20 LTS or 24 LTS)

---

## Clean Up Resources

When done learning:

```bash
az group delete --name June-RG --yes --no-wait
```

---

## Key Concepts Learned

### 1. Application Logs (`traces` table)
- Console logs automatically captured
- Use structured logging (JSON) for better queries
- View in: Logs → `traces` table

### 2. Exception Logs (`exceptions` table)
- Unhandled exceptions auto-tracked
- Handled exceptions can be logged manually
- View in: Failures panel or `exceptions` table

### 3. Request Tracing (`requests`, `dependencies` tables)
- Automatic HTTP request tracking
- Custom spans for operations
- View in: Transaction search, Application map

### 4. Performance Monitoring
- Live Metrics for real-time view
- Custom metrics and histograms
- View in: Performance panel, Metrics

---

## Resources

- [Azure Monitor OpenTelemetry for Node.js](https://learn.microsoft.com/en-us/javascript/api/overview/azure/monitor-opentelemetry-readme)
- [Application Insights KQL Reference](https://learn.microsoft.com/en-us/azure/data-explorer/kql-quick-reference)
- [OpenTelemetry Concepts](https://opentelemetry.io/docs/concepts/)
