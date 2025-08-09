// Performance monitoring middleware and utilities

// Global metrics storage
global.performanceMetrics = {
  translations: {
    count: 0,
    totalLatency: 0,
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0
  },
  connections: {
    active: 0,
    total: 0,
    peak: 0
  },
  errors: {
    count: 0,
    types: {}
  },
  startTime: Date.now(),
  lastReset: Date.now()
};

export function performanceMonitor(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 100) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }
  });
  
  next();
}

export function recordTranslation(latency) {
  const metrics = global.performanceMetrics.translations;
  
  metrics.count++;
  metrics.totalLatency += latency;
  metrics.avgLatency = metrics.totalLatency / metrics.count;
  metrics.minLatency = Math.min(metrics.minLatency, latency);
  metrics.maxLatency = Math.max(metrics.maxLatency, latency);
  
  // Log if latency exceeds target
  if (latency > 200) {
    console.warn(`⚠️ Translation latency ${latency}ms exceeds 200ms target`);
  }
}

export function recordConnection(type = 'connect') {
  const metrics = global.performanceMetrics.connections;
  
  if (type === 'connect') {
    metrics.active++;
    metrics.total++;
    metrics.peak = Math.max(metrics.peak, metrics.active);
  } else if (type === 'disconnect') {
    metrics.active = Math.max(0, metrics.active - 1);
  }
}

export function recordError(errorType) {
  const metrics = global.performanceMetrics.errors;
  
  metrics.count++;
  metrics.types[errorType] = (metrics.types[errorType] || 0) + 1;
}

// Reset metrics every hour
setInterval(() => {
  const uptime = Date.now() - global.performanceMetrics.startTime;
  const avgLatency = global.performanceMetrics.translations.avgLatency;
  
  console.log(`📊 Hourly Performance Report:`);
  console.log(`   Uptime: ${Math.floor(uptime / 1000 / 60 / 60)}h`);
  console.log(`   Translations: ${global.performanceMetrics.translations.count}`);
  console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`   Peak Connections: ${global.performanceMetrics.connections.peak}`);
  console.log(`   Errors: ${global.performanceMetrics.errors.count}`);
  
  // Reset counters but keep running averages
  global.performanceMetrics.translations.count = 0;
  global.performanceMetrics.translations.totalLatency = 0;
  global.performanceMetrics.connections.peak = global.performanceMetrics.connections.active;
  global.performanceMetrics.errors.count = 0;
  global.performanceMetrics.lastReset = Date.now();
}, 3600000); // 1 hour