# Application Insights Portal Queries

Copy-paste these KQL queries into Azure Portal → Application Insights → Logs

---

## 1. Application Logs (Traces)

### All recent traces
```kql
traces
| where timestamp > ago(1h)
| project timestamp, message, severityLevel, customDimensions
| order by timestamp desc
```

### Filter by log level
```kql
traces
| where severityLevel == 3  // 1=Error, 2=Warning, 3=Info
| project timestamp, message
| order by timestamp desc
```

### Search for specific message
```kql
traces
| where message contains "batch"
| project timestamp, message
```

### Traces from specific route
```kql
traces
| where customDimensions.route == "/api/logs"
| project timestamp, message, customDimensions
```

---

## 2. Exception Logs

### All recent exceptions
```kql
exceptions
| where timestamp > ago(1h)
| project timestamp, type, outerMessage, handledAt
| order by timestamp desc
```

### Exception details with stack
```kql
exceptions
| where timestamp > ago(1h)
| project timestamp, type, outerMessage, parsedStack
| order by timestamp desc
```

### Exceptions by type (summary)
```kql
exceptions
| where timestamp > ago(24h)
| summarize count() by type, outerMessage
| top 10 by count_
```

### Exceptions per hour
```kql
exceptions
| where timestamp > ago(24h)
| summarize count() by bin(timestamp, 1h)
| render timechart
```

---

## 3. Request Tracing

### All recent requests
```kql
requests
| where timestamp > ago(1h)
| project timestamp, name, url, resultCode, duration, success
| order by timestamp desc
```

### Failed requests only
```kql
requests
| where success == false
| project timestamp, name, resultCode, duration
| order by timestamp desc
```

### Request duration percentiles
```kql
requests
| where timestamp > ago(1h)
| summarize percentiles(duration, 50, 90, 95, 99) by bin(timestamp, 5m)
| render timechart
```

### Requests per minute
```kql
requests
| where timestamp > ago(1h)
| summarize count() by bin(timestamp, 1m)
| render timechart
```

### Slowest requests
```kql
requests
| where timestamp > ago(1h)
| top 20 by duration desc
| project timestamp, name, url, duration
```

---

## 4. Dependencies (DB, HTTP calls)

### All dependencies
```kql
dependencies
| where timestamp > ago(1h)
| project timestamp, type, name, target, resultCode, duration
| order by timestamp desc
```

### Database calls
```kql
dependencies
| where type == "SQL" or type contains "postgres"
| project timestamp, name, target, duration
```

### HTTP calls
```kql
dependencies
| where type == "HTTP"
| project timestamp, name, target, resultCode, duration
```

### Failed dependencies
```kql
dependencies
| where success == false
| project timestamp, type, name, resultCode
```

---

## 5. Performance Metrics

### Custom metrics
```kql
customMetrics
| where timestamp > ago(1h)
| project timestamp, name, value
| order by timestamp desc
```

### Custom metrics aggregated
```kql
customMetrics
| where timestamp > ago(1h)
| summarize avg(value), min(value), max(value), count() by name
```

### Performance counters (CPU, memory)
```kql
performanceCounters
| where timestamp > ago(1h)
| where category == "Process"
| summarize avg(value) by counter, bin(timestamp, 1m)
| render timechart
```

### Memory usage over time
```kql
performanceCounters
| where counter == "Private Bytes" or counter contains "memory"
| summarize avg(value) by counter, bin(timestamp, 1m)
| render timechart
```

---

## 6. End-to-End Tracing

### Request with all related telemetry
```kql
// Get a specific request ID first
let requestId = requests
| where timestamp > ago(1h)
| limit 1
| project operation_Id;
union requests, dependencies, traces, exceptions
| where operation_Id in (requestId)
| project timestamp, itemType, name, message, type, resultCode, duration
| order by timestamp asc
```

### Transaction timeline
```kql
// Replace with your operation_Id
let opId = "YOUR_OPERATION_ID";
union requests, dependencies, traces, exceptions
| where operation_Id == opId
| project timestamp, itemType, name, message, duration
| order by timestamp asc
```

---

## 7. Live Metrics Preview

### Current request rate
```kql
requests
| where timestamp > ago(5m)
| summarize count() by bin(timestamp, 10s)
| render timechart
```

### Current failure rate
```kql
requests
| where timestamp > ago(5m)
| summarize 
    Total = count(),
    Failed = countif(success == false)
| extend FailureRate = Failed * 100.0 / Total
```

### Active operations now
```kql
requests
| where timestamp > ago(1m)
| project timestamp, name, duration, success
| order by timestamp desc
```

---

## Portal Navigation

### Where to find things:

| Telemetry Type | Portal Location | Table Name |
|---------------|-----------------|------------|
| Application Logs | Application Insights → Logs | `traces` |
| Exceptions | Application Insights → Failures | `exceptions` |
| Requests | Application Insights → Performance | `requests` |
| Dependencies | Application Insights → Application Map | `dependencies` |
| Custom Metrics | Application Insights → Metrics | `customMetrics` |
| Performance Counters | Application Insights → Metrics | `performanceCounters` |

### Key Panels:

1. **Application Map** - Visual topology of dependencies
2. **Transaction Search** - Search and filter requests
3. **Failures** - Exception analysis
4. **Performance** - Request duration analysis
5. **Metrics** - Custom charts and dashboards
6. **Live Metrics** - Real-time stream (very cool!)
7. **Logs** - KQL query interface

---

## Pro Tips

1. **Pin charts to dashboard** - Click pin icon on any chart
2. **Set alerts** - Application Insights → Alerts → Create alert rule
3. **Export queries** - Save useful queries for reuse
4. **Cross-correlate** - Click on any request to see all related telemetry
5. **Time range picker** - Always check your time range in the UI
