const net = require("net");
const TCPServer = require("../tcp/TcpServer");
const parseRequest = require("../utils/parseRequest");
const WorkerManager = require("../utils/workerManager");
const SlidingWindowCounter = require("../utils/rateLimiter");
const RequestQueue = require("../utils/requestQueue");

class HTTPServer extends TCPServer {
  constructor(host, port) {
    const actualHost = host || "127.0.0.1";
    const actualPort = port || process.env.PORT || 8080;
    super(actualHost, actualPort);

    this.router = null;
    this.workerManager = new WorkerManager();
    this.rateLimiter = new SlidingWindowCounter(
      process.env.RATE_LIMIT_WINDOW_MS || 60000,
      process.env.RATE_LIMIT_MAX_REQUESTS || 100
    );
    this.requestQueue = new RequestQueue(process.env.MAX_QUEUE_SIZE || 1000);
    this.inFlightRequests = 0;
  }

  async start() {
    return new Promise((resolve, reject) => {
      if (this.server) {
        reject(new Error("Server is already running"));
        return;
      }

      this.server = net.createServer({
        keepAlive: true,
        keepAliveInitialDelay: 1000,
        maxConnections: this.maxConnections
      }, this._handleConnection.bind(this));

      this.server.on("error", (err) => {
        console.error("Server error:", err);
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`🚀 HTTP Server running on http://${this.host}:${this.port}`);
        console.log("Render-compatible server started on port:", this.port);
        resolve();
      });
    });
  }

  async handleRequest(chunk) {
    this.inFlightRequests++;
    let req;

    try {
      req = parseRequest(chunk);
    } catch (error) {
      this.inFlightRequests--;
      this._checkShutdownComplete();
      return this.buildResponse(400, {
        error: "Bad Request",
        code: error.code || "INVALID_REQUEST",
        message: error.message
      });
    }

    if (this.isShuttingDown) {
      this.inFlightRequests--;
      this._checkShutdownComplete();
      return this.buildResponse(503, "Service Unavailable");
    }

    // ✅ Special Dynamic Route Registration Logic
    if (req.method === "POST" && req.path === "/admin/routes") {
      const { method, path, response } = req.body;

      if (!method || !path || !response) {
        this.inFlightRequests--;
        this._checkShutdownComplete();
        return this.buildResponse(400, {
          error: "Missing 'method', 'path', or 'response' in body."
        });
      }

      this.router.add(method.toUpperCase(), path, () => ({
        statusCode: response.statusCode || 200,
        body: response.body || {}
      }));

      this.inFlightRequests--;
      this._checkShutdownComplete();
      return this.buildResponse(201, {
        message: `✅ Route [${method.toUpperCase()} ${path}] added successfully.`
      });
    }

    const clientIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
    const rateLimitResult = this.rateLimiter.isRateLimited(clientIp);

    if (rateLimitResult.limited) {
      this.inFlightRequests--;
      this._checkShutdownComplete();
      return this.buildResponse(429, {
        error: "Too Many Requests",
        reason: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter,
        currentCount: rateLimitResult.currentCount,
        maxRequests: rateLimitResult.maxRequests
      }, {
        "Retry-After": rateLimitResult.retryAfter,
        "X-RateLimit-Limit": rateLimitResult.maxRequests,
        "X-RateLimit-Remaining": Math.max(0, rateLimitResult.maxRequests - (rateLimitResult.currentCount || 0)),
        "X-RateLimit-Reset": Math.ceil(Date.now() / 1000) + rateLimitResult.retryAfter
      });
    }

    const handler = this.router?.match(req.method, req.path);
    if (!handler) {
      this.inFlightRequests--;
      this._checkShutdownComplete();
      return this.buildResponse(404, {
        error: "Not Found",
        path: req.path,
        method: req.method
      });
    }

    try {
      const priority = this._getRequestPriority(req);

      const result = await this.requestQueue.add(async () => {
        if (req.headers["x-intensive-task"] === "true") {
          const workerResult = await this.workerManager.executeTask({
            method: req.method,
            path: req.path,
            body: req.body,
            headers: req.headers
          });

          return {
            statusCode: workerResult.statusCode || 200,
            body: workerResult.body,
            headers: {
              "Content-Type": "application/json",
              ...workerResult.headers
            }
          };
        }

        return handler(req);
      }, priority);

      const headers = {
        ...result.headers,
        "X-RateLimit-Limit": this.rateLimiter.maxRequests,
        "X-RateLimit-Remaining": Math.max(0, this.rateLimiter.maxRequests - this.rateLimiter.getCurrentCount(clientIp)),
        "X-RateLimit-Reset": Math.ceil(Date.now() / 1000) + this.rateLimiter.windowSizeMs / 1000
      };

      return this.buildResponse(result.statusCode || 200, result.body, headers);
    } catch (error) {
      console.error("Error handling request:", error);
      return this.buildResponse(500, {
        error: "Internal Server Error",
        message: error.message,
        code: error.code || "INTERNAL_ERROR"
      });
    } finally {
      this.inFlightRequests--;
      this._checkShutdownComplete();
    }
  }

  _getRequestPriority(req) {
    if (req.headers["x-priority"]) {
      return parseInt(req.headers["x-priority"], 10);
    }

    const priorityMap = {
      GET: 1,
      POST: 2,
      PUT: 2,
      DELETE: 3,
      PATCH: 2
    };

    return priorityMap[req.method] || 1;
  }

  buildResponse(statusCode, body, headers = {}) {
    const statusMessages = {
      200: "OK",
      201: "Created",
      204: "No Content",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      413: "Payload Too Large",
      429: "Too Many Requests",
      500: "Internal Server Error",
      503: "Service Unavailable"
    };

    const statusLine = `HTTP/1.1 ${statusCode} ${statusMessages[statusCode] || ""}\r\n`;

    if (typeof body === "object" && body !== null) {
      body = JSON.stringify(body);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    } else if (typeof body !== "string") {
      body = String(body);
    }

    headers["Content-Length"] = Buffer.byteLength(body);
    headers["Connection"] = headers["Connection"] || "close";
    headers["Date"] = new Date().toUTCString();

    const headerLines = Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");

    return Buffer.from(`${statusLine}${headerLines}\r\n\r\n${body}`);
  }

  buildErrorResponse() {
    return this.buildResponse(500, "Internal Server Error");
  }

  _checkShutdownComplete() {
    if (this.isShuttingDown && this.inFlightRequests === 0) {
      if (this._resolveShutdown) {
        this._resolveShutdown();
        this._resolveShutdown = null;
      }
    }
  }

  async stop() {
    if (!this.server || this.isShuttingDown) return Promise.resolve();

    this.isShuttingDown = true;

    return new Promise((resolve) => {
      this._resolveShutdown = resolve;
      this.server.close(() => {
        console.log("Server stopped accepting new connections");
      });

      this._checkShutdownComplete();
    });
  }

  isRunning() {
    return !!this.server && this.server.listening;
  }

  getStats() {
    return {
      connections: this.getConnectionStats(),
      rateLimiter: {
        windowSizeMs: this.rateLimiter.windowSizeMs,
        maxRequests: this.rateLimiter.maxRequests,
        currentCount: this.rateLimiter.getCurrentCount()
      },
      queue: this.requestQueue.getQueueStats(),
      workers: this.workerManager.getStats(),
      status: this.isRunning() ? "running" : "stopped",
      isShuttingDown: this.isShuttingDown
    };
  }

  _handleConnection(socket) {
    if (this.isShuttingDown) {
      socket.end(this.buildResponse(503, "Service Unavailable"));
      return;
    }

    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log("Client connected:", clientId);

    socket.setTimeout(this.connectionTimeout);
    socket.setKeepAlive(true, this.keepAliveTimeout);

    this.activeConnections.set(clientId, {
      socket,
      lastActivity: Date.now()
    });

    socket.on("data", async (chunk) => {
      try {
        const connection = this.activeConnections.get(clientId);
        if (connection) connection.lastActivity = Date.now();

        if (this.isShuttingDown) {
          socket.end(this.buildResponse(503, "Service Unavailable"));
          return;
        }

        const response = await this.handleRequest(chunk);

        if (socket.writable) {
          if (!this.shouldKeepAlive(chunk)) {
            socket.end(response);
          } else {
            socket.write(response);
          }
        }
      } catch (error) {
        console.error("Error handling request:", error);
        if (socket.writable) {
          socket.end(this.buildErrorResponse());
        }
      }
    });

    socket.on("timeout", () => {
      console.log(`Connection timeout for client: ${clientId}`);
      if (socket.writable) {
        socket.write(this.buildResponse(408, "Request Timeout"));
        socket.end();
      }
    });

    socket.on("error", (error) => {
      console.error(`Socket error for client ${clientId}:`, error);
      this.activeConnections.delete(clientId);
    });

    socket.on("close", () => {
      console.log("🔌 Connection closed:", clientId);
      this.activeConnections.delete(clientId);
    });
  }
}

if (require.main === module) {
  const Router = require("../utils/router"); // adjust path if needed
  const router = new Router();

  const server = new HTTPServer();
  server.router = router; // ✅ assign router before starting server

  server.start().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
module.exports = HTTPServer;
