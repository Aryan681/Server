const TCPServer = require("../tcp/TcpServer");
const parseRequest = require("../utils/parseRequest");
const WorkerManager = require("../utils/workerManager");
const SlidingWindowCounter = require("../utils/rateLimiter");
const RequestQueue = require("../utils/requestQueue");

//override the tcp server by extending it
class HTTPServer extends TCPServer {
  constructor(host, port) {
    super(host, port);
    this.router = null;
    this.workerManager = new WorkerManager();
    this.rateLimiter = new SlidingWindowCounter(
      process.env.RATE_LIMIT_WINDOW_MS || 60000,
      process.env.RATE_LIMIT_MAX_REQUESTS || 100
    );
    this.requestQueue = new RequestQueue(
      process.env.MAX_QUEUE_SIZE || 1000
    );
  }
  setRouter(router) {
    this.router = router;
  }

  async handleRequest(chunk) {
    const req = parseRequest(chunk);
    console.log("parsed req", req);

    if (!req) {
      return this.buildResponse(400, "Bad Request");
    }

    // Get client IP for rate limiting
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';

    // Check rate limit
    if (this.rateLimiter.isRateLimited(clientIp)) {
      return this.buildResponse(429, {
        error: "Too Many Requests",
        retryAfter: Math.ceil(this.rateLimiter.windowSizeMs / 1000)
      }, {
        'Retry-After': Math.ceil(this.rateLimiter.windowSizeMs / 1000)
      });
    }

    const handler = this.router?.match(req.method, req.path);

    if (handler) {
      try {
        // Queue the request with priority
        const priority = this._getRequestPriority(req);
        const result = await this.requestQueue.add(async () => {
          // Check if the request needs CPU-intensive processing
          if (req.headers['x-intensive-task'] === 'true') {
            // Offload to worker thread
            return await this.workerManager.executeTask({
              method: req.method,
              path: req.path,
              body: req.body
            });
          }

          // Normal request handling
          return handler(req);
        }, priority);

        return this.buildResponse(result.statusCode, result.body, result.headers);
      } catch (error) {
        console.error('Error handling request:', error);
        return this.buildResponse(500, "Internal Server Error");
      }
    }
     return this.buildResponse(404, "Not Found");
  }

  _getRequestPriority(req) {
    // Define priority based on request type and headers
    if (req.headers['x-priority']) {
      return parseInt(req.headers['x-priority'], 10);
    }

    // Default priorities
    const priorityMap = {
      'GET': 1,
      'POST': 2,
      'PUT': 2,
      'DELETE': 3
    };

    return priorityMap[req.method] || 1;
  }

  buildResponse(statusCode, body, headers = {}) {
    const statusMessage = {
      200: "OK",
      404: "Not Found",
      400: "Bad Request",
      500: "Internal Server Error",
      429: "Too Many Requests"
    };

    const statusLine = `HTTP/1.1 ${statusCode} ${statusMessage[statusCode]}\r\n`;
    
    // Convert body to string if it's an object
    if (typeof body === 'object' && body !== null) {
      body = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    
    headers["Content-Length"] = Buffer.byteLength(body);
    headers["Content-Type"] = headers["Content-Type"] || "text/plain";

    const headerLines = Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");

    return Buffer.from(`${statusLine}${headerLines}\r\n\r\n${body}`);
  }

  // Get server statistics
  getStats() {
    return {
      connections: this.getConnectionStats(),
      rateLimiter: {
        windowSizeMs: this.rateLimiter.windowSizeMs,
        maxRequests: this.rateLimiter.maxRequests
      },
      queue: this.requestQueue.getQueueStats(),
      workers: this.workerManager.getStats()
    };
  }
}

module.exports = HTTPServer;
