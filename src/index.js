import express from 'express';
import { useAzureMonitor } from '@azure/monitor-opentelemetry';
import { trace, metrics } from '@opentelemetry/api';

// Initialize Application Insights with OpenTelemetry
// In Azure App Service, APPLICATIONINSIGHTS_CONNECTION_STRING is auto-injected
// For local dev, set it in .env or environment variable
const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  useAzureMonitor({
    connectionString,
    enableLiveMetrics: true,
  });
  console.log('✓ Application Insights initialized');
} else {
  console.warn('⚠ APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry disabled');
}

// Get tracer and meter for custom telemetry
const tracer = trace.getTracer('azure-lab-app', '1.0.0');
const meter = metrics.getMeter('azure-lab-app', '1.0.0');

// Create custom metrics
const requestCounter = meter.createCounter('app.requests', {
  description: 'Total request count',
});

const errorCounter = meter.createCounter('app.errors', {
  description: 'Total error count',
});

const processingTimeHistogram = meter.createHistogram('app.processing_time_ms', {
  description: 'Request processing time in milliseconds',
});

// Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ============================================
// 1. APPLICATION LOGS
// ============================================

// Simple logger that demonstrates different log levels
const logger = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({ level: 'INFO', message, ...data, timestamp: new Date().toISOString() }));
  },
  warn: (message, data = {}) => {
    console.warn(JSON.stringify({ level: 'WARN', message, ...data, timestamp: new Date().toISOString() }));
  },
  error: (message, data = {}) => {
    console.error(JSON.stringify({ level: 'ERROR', message, ...data, timestamp: new Date().toISOString() }));
  }
};

// ============================================
// ROUTES - Each demonstrates a learning area
// ============================================

// Health check
app.get('/', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'healthy', 
    message: 'Azure App Insights Lab Running',
    insights_enabled: !!connectionString 
  });
});

// ---
// 1. APPLICATION LOGS DEMO
// ---
app.get('/api/logs', (req, res) => {
  const { level = 'info', message = 'Sample log message' } = req.query;
  
  // These console logs are automatically captured by Application Insights
  logger[level](`User requested log: ${message}`, { 
    route: '/api/logs',
    userAgent: req.get('user-agent')
  });
  
  res.json({ 
    logged: true, 
    level, 
    message,
    note: 'Check Azure Portal > Application Insights > Logs > traces table'
  });
});

// Batch logging to show volume
app.post('/api/logs/batch', (req, res) => {
  const { count = 10 } = req.body;
  
  for (let i = 0; i < count; i++) {
    logger.info(`Batch log entry ${i + 1}`, { batchId: Date.now(), index: i });
  }
  
  res.json({ 
    logged: count, 
    note: 'Check traces table in Logs query'
  });
});

// ---
// 2. EXCEPTION LOGS DEMO
// ---
app.get('/api/error', (req, res) => {
  // Track error count
  errorCounter.add(1, { type: 'demonstration' });
  
  // Log error
  logger.error('Demonstrating error logging', { route: '/api/error' });
  
  // Throw a deliberate error - this gets captured automatically
  throw new Error('This is a demonstration error for Application Insights');
});

app.get('/api/error/handled', (req, res) => {
  try {
    // Simulate a failing operation
    throw new Error('Simulated business logic error');
  } catch (error) {
    errorCounter.add(1, { type: 'handled', route: '/api/error/handled' });
    logger.error('Caught and logged error', { 
      error: error.message, 
      stack: error.stack 
    });
    
    res.status(500).json({ 
      error: true, 
      message: error.message,
      note: 'Check exceptions table in Logs query'
    });
  }
});

app.get('/api/error/async', async (req, res) => {
  // Async error - also captured
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const asyncError = new Error('Async operation failed');
  errorCounter.add(1, { type: 'async' });
  logger.error('Async error occurred', { error: asyncError.message });
  
  res.status(500).json({ 
    error: true, 
    message: asyncError.message 
  });
});

// ---
// 3. REQUEST TRACING DEMO
// ---
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();
  
  // Start a span for detailed tracing
  tracer.startActiveSpan('getUserById', span => {
    span.setAttribute('user.id', id);
    span.setAttribute('user.request_source', req.get('x-request-source') || 'unknown');
    
    // Simulate database lookup
    tracer.startActiveSpan('database.query', dbSpan => {
      dbSpan.setAttribute('db.system', 'postgresql');
      dbSpan.setAttribute('db.statement', 'SELECT * FROM users WHERE id = $1');
      
      // Simulate DB delay
      setTimeout(() => {
        dbSpan.end();
        
        // Simulate cache check
        tracer.startActiveSpan('cache.lookup', cacheSpan => {
          cacheSpan.setAttribute('cache.key', `user:${id}`);
          cacheSpan.setAttribute('cache.hit', false);
          cacheSpan.end();
          
          // Record processing time
          const duration = Date.now() - startTime;
          processingTimeHistogram.record(duration, { route: '/api/users/:id' });
          requestCounter.add(1, { route: '/api/users/:id', method: 'GET' });
          
          span.end();
          
          res.json({
            user: { id, name: `User ${id}`, email: `user${id}@example.com` },
            traceContext: {
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
            },
            processingTime: `${duration}ms`,
            note: 'Check dependencies table for DB and cache spans'
          });
        });
      }, 50);
    });
  });
});

app.get('/api/orders', (req, res) => {
  const startTime = Date.now();
  
  tracer.startActiveSpan('getOrders', span => {
    span.setAttribute('orders.page', req.query.page || 1);
    
    // Simulate calling external service
    tracer.startActiveSpan('http.call', httpSpan => {
      httpSpan.setAttribute('http.method', 'GET');
      httpSpan.setAttribute('http.url', 'https://api.example.com/orders');
      
      setTimeout(() => {
        httpSpan.end();
        
        const duration = Date.now() - startTime;
        processingTimeHistogram.record(duration, { route: '/api/orders' });
        requestCounter.add(1, { route: '/api/orders', method: 'GET' });
        
        span.end();
        
        res.json({
          orders: [
            { id: 1, total: 99.99 },
            { id: 2, total: 149.50 }
          ],
          processingTime: `${duration}ms`,
          note: 'Check requests table for end-to-end trace'
        });
      }, 100);
    });
  });
});

// ---
// 4. PERFORMANCE MONITORING DEMO
// ---
app.get('/api/performance/slow', (req, res) => {
  const startTime = Date.now();
  const delay = parseInt(req.query.delay) || 2000;
  
  tracer.startActiveSpan('slowOperation', span => {
    span.setAttribute('operation.delay_ms', delay);
    
    // Simulate slow processing
    setTimeout(() => {
      const duration = Date.now() - startTime;
      processingTimeHistogram.record(duration, { route: '/api/performance/slow' });
      requestCounter.add(1, { route: '/api/performance/slow', method: 'GET' });
      
      span.end();
      
      res.json({
        message: 'Slow operation completed',
        delay: `${delay}ms`,
        actualDuration: `${duration}ms`,
        note: 'Check performance panel and metrics in Application Insights'
      });
    }, delay);
  });
});

app.get('/api/performance/memory', (req, res) => {
  // Force some memory allocation
  const allocations = [];
  const mb = parseInt(req.query.mb) || 10;
  
  for (let i = 0; i < mb; i++) {
    allocations.push(Buffer.alloc(1024 * 1024)); // 1MB
  }
  
  const memUsage = process.memoryUsage();
  
  res.json({
    memoryAllocated: `${mb}MB`,
    currentUsage: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    note: 'Check performanceCounters table for memory metrics'
  });
});

// Custom metrics demo
app.get('/api/metrics', (req, res) => {
  const value = parseFloat(req.query.value) || Math.random() * 100;
  
  // Record custom metric
  const customMetric = meter.createHistogram('app.business_value');
  customMetric.record(value, { source: 'demo' });
  
  requestCounter.add(1, { route: '/api/metrics', method: 'GET' });
  
  res.json({
    metricRecorded: 'app.business_value',
    value,
    note: 'Check customMetrics table in Logs query'
  });
});

// ---
// ERROR HANDLING
// ---
app.use((err, req, res, next) => {
  errorCounter.add(1, { type: 'unhandled', path: req.path });
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path 
  });
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// ---
// START SERVER
// ---
app.listen(PORT, () => {
  console.log(`\n🚀 Azure App Insights Lab running on http://localhost:${PORT}`);
  console.log('\n📚 Test endpoints:');
  console.log('  Application Logs:');
  console.log(`    GET  http://localhost:${PORT}/api/logs?level=info&message=test`);
  console.log(`    POST http://localhost:${PORT}/api/logs/batch (body: {"count": 10})`);
  console.log('\n  Exception Logs:');
  console.log(`    GET  http://localhost:${PORT}/api/error (throws error)`);
  console.log(`    GET  http://localhost:${PORT}/api/error/handled`);
  console.log(`    GET  http://localhost:${PORT}/api/error/async`);
  console.log('\n  Request Tracing:');
  console.log(`    GET  http://localhost:${PORT}/api/users/123`);
  console.log(`    GET  http://localhost:${PORT}/api/orders`);
  console.log('\n  Performance Monitoring:');
  console.log(`    GET  http://localhost:${PORT}/api/performance/slow?delay=1000`);
  console.log(`    GET  http://localhost:${PORT}/api/performance/memory?mb=50`);
  console.log(`    GET  http://localhost:${PORT}/api/metrics?value=42`);
  console.log('\n');
});
