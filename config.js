module.exports = {
    server: {
        host: process.env.HOST || '127.0.0.1',
        port: process.env.PORT || 8080,
        maxConnections: process.env.MAX_CONNECTIONS || 1000,
        connectionTimeout: process.env.CONNECTION_TIMEOUT || 30000,
        keepAliveTimeout: process.env.KEEP_ALIVE_TIMEOUT || 5000
    },
    rateLimit: {
        windowSizeMs: process.env.RATE_LIMIT_WINDOW_MS || 60000,
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
    },
    queue: {
        maxSize: process.env.MAX_QUEUE_SIZE || 1000
    },
    workers: {
        maxWorkers: process.env.MAX_WORKERS || Math.max(1, require('os').cpus().length - 1)
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json'
    }
}; 