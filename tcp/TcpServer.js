const net = require("net");

class TCPServer {
  constructor(host, port) {
    this.host = host || "0.0.0.0";  
    this.port = port || process.env.PORT || 8080; 
    this.maxConnections = 1000;
    this.connectionTimeout = 30000;
    this.keepAliveTimeout = 5000;
    this.activeConnections = new Map();
    this.server = null;
  }

  getConnectionStats() {
    return {
      activeConnections: this.activeConnections.size,
      maxConnections: this.maxConnections
    };
  }

  shouldKeepAlive(chunk) {
    const request = chunk.toString();
    const keepAliveHeader = request.match(/Connection: (.*)/i);
    return keepAliveHeader && keepAliveHeader[1].toLowerCase() === 'keep-alive';
  }

  buildErrorResponse() {
    return Buffer.from(
      'HTTP/1.1 500 Internal Server Error\r\n' +
      'Content-Type: text/plain\r\n' +
      'Content-Length: 21\r\n\r\n' +
      'Internal Server Error'
    );
  }
}

module.exports = TCPServer;