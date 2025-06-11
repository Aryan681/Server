const HTTPServer = require("./core/httpServer")
const Router = require('./utils/router');
const fs = require('fs');
const path = require('path');
const router = new Router();

// Serve the home page
router.add("GET", "/", (req, res) => {
  const homePage = fs.readFileSync(path.join(__dirname, 'pages', 'home.html'), 'utf8');
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: homePage
  };
});

// Dynamic routes for the demo
router.add("GET", "/user/:id", (req) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      message: "User Profile",
      userId: req.params.id,
      name: "Demo User",
      email: "user@example.com"
    }
  };
});

router.add("GET", "/posts/:id", (req) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      message: "Blog Post",
      postId: req.params.id,
      title: "Sample Blog Post",
      content: "This is a sample blog post content."
    }
  };
});

router.add("GET", "/products/:id", (req) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      message: "Product Details",
      productId: req.params.id,
      name: "Sample Product",
      price: 99.99
    }
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
