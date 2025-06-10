const net = require("net");

class TCPServer {
    constructor(host, port) {
        this.host = host || "127.0.0.1";
        this.port = port || 8080;
        this.maxConnections = 1000; // Maximum number of concurrent connections
        this.connectionTimeout = 30000; // 30 seconds timeout
        this.keepAliveTimeout = 5000; // 5 seconds keep-alive
        this.activeConnections = new Map();
    }

    start() {
        const server = net.createServer({
            keepAlive: true,
            keepAliveInitialDelay: 1000,
            maxConnections: this.maxConnections
        }, (socket) => {
            const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            console.log("Client connected:", clientId);
            
            // Set socket timeouts
            socket.setTimeout(this.connectionTimeout);
            socket.setKeepAlive(true, this.keepAliveTimeout);

            // Track active connection
            this.activeConnections.set(clientId, {
                socket,
                lastActivity: Date.now()
            });

            socket.on("data", async (chunk) => {
                try {
                    // Update last activity time
                    const connection = this.activeConnections.get(clientId);
                    if (connection) {
                        connection.lastActivity = Date.now();
                    }

                    console.log("Raw req:\n" + chunk.toString());
                    const response = await this.handleRequest(chunk);
                    
                    // Check if connection is still valid
                    if (socket.writable) {
                        socket.write(response);
                        // Don't end the connection immediately to support keep-alive
                        if (!this.shouldKeepAlive(chunk)) {
                            socket.end();
                        }
                    }
                } catch (error) {
                    console.error('Error handling request:', error);
                    if (socket.writable) {
                        socket.write(this.buildErrorResponse());
                        socket.end();
                    }
                }
            });

            socket.on("timeout", () => {
                console.log(`Connection timeout for client: ${clientId}`);
                socket.end();
            });

            socket.on("error", (error) => {
                console.error(`Socket error for client ${clientId}:`, error);
                this.activeConnections.delete(clientId);
            });

            socket.on("close", () => {
                console.log("🔌 Connection closed:", clientId);
                this.activeConnections.delete(clientId);
            });
        });

        // Handle server errors
        server.on("error", (error) => {
            console.error("Server error:", error);
            if (error.code === "EADDRINUSE") {
                console.error(`Port ${this.port} is already in use`);
            }
        });

        server.listen(this.port, this.host, () => {
            console.log(`🚀 TCP Server running at http://${this.host}:${this.port}`);
            console.log(`Maximum concurrent connections: ${this.maxConnections}`);
        });
    }

    shouldKeepAlive(chunk) {
        const request = chunk.toString();
        const keepAliveHeader = request.match(/Connection: (.*)/i);
        return keepAliveHeader && keepAliveHeader[1].toLowerCase() === 'keep-alive';
    }

    async handleRequest(chunk) {
        return chunk;
    }

    buildErrorResponse() {
        return Buffer.from(
            'HTTP/1.1 500 Internal Server Error\r\n' +
            'Content-Type: text/plain\r\n' +
            'Content-Length: 21\r\n\r\n' +
            'Internal Server Error'
        );
    }

    // Get current connection statistics
    getConnectionStats() {
        return {
            activeConnections: this.activeConnections.size,
            maxConnections: this.maxConnections
        };
    }
}

module.exports = TCPServer;