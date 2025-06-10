const HTTPServer = require("./core/httpServer")
const Router = require('./utils/router');
const router = new Router();

router.add("GET", "/", (req, res) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: "Hello from the Home route"
  };
});

router.add("GET", "/about", (req, res) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: "About Page"
  };
});

// Test POST route to verify body parsing
router.add("POST", "/echo", (req, res) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: `Received body: ${req.body}`
  };
});

// Test JSON routes
router.add("POST", "/api/data", (req, res) => {
  // This route expects a JSON body and returns a JSON response
  if (!req.body || typeof req.body !== 'object') {
    return {
      statusCode: 400,
      body: { error: "Invalid JSON body" }
    };
  }

  return {
    statusCode: 200,
    body: {
      message: "Data received successfully",
      receivedData: req.body
    }
  };
});

router.add("GET", "/api/status", (req, res) => {
  return {
    statusCode: 200,
    body: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    }
  };
});

// Test parameterized routes
router.add("GET", "/user/:id", (req) => {
  return {
    statusCode: 200,
    body: {
      message: "User details",
      userId: req.params.id
    }
  };
});

router.add("GET", "/posts/:category/:id", (req) => {
  return {
    statusCode: 200,
    body: {
      message: "Post details",
      category: req.params.category,
      postId: req.params.id
    }
  };
});

// Test CPU-intensive task route
router.add("POST", "/api/compute", (req) => {
  // This route will be handled by worker threads
  return {
    statusCode: 200,
    body: {
      message: "Task queued for processing",
      taskId: Date.now()
    }
  };
});

const server = new HTTPServer("127.0.0.1", 8080);
server.setRouter(router);
server.start();
