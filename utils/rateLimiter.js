class SlidingWindowCounter {
    constructor(windowSizeMs = 60000, maxRequests = 100) {
        this.windowSizeMs = windowSizeMs; // 1 minute default
        this.maxRequests = maxRequests;
        this.windows = new Map(); // Map of client IP to their request windows
        this.blockedClients = new Map(); // Track blocked clients and their block expiry
    }

    _getCurrentWindow() {
        const now = Date.now();
        return Math.floor(now / this.windowSizeMs);
    }

    _cleanupOldWindows(clientId) {
        const currentWindow = this._getCurrentWindow();
        const clientWindows = this.windows.get(clientId);
        
        if (clientWindows) {
            for (const [windowId] of clientWindows) {
                if (windowId < currentWindow - 1) {
                    clientWindows.delete(windowId);
                }
            }
        }
    }

    _isClientBlocked(clientId) {
        const blockExpiry = this.blockedClients.get(clientId);
        if (!blockExpiry) return false;

        if (Date.now() > blockExpiry) {
            this.blockedClients.delete(clientId);
            return false;
        }

        return true;
    }

    isRateLimited(clientId) {
        // Check if client is blocked
        if (this._isClientBlocked(clientId)) {
            return {
                limited: true,
                reason: 'BLOCKED',
                retryAfter: Math.ceil((this.blockedClients.get(clientId) - Date.now()) / 1000)
            };
        }

        const currentWindow = this._getCurrentWindow();
        
        if (!this.windows.has(clientId)) {
            this.windows.set(clientId, new Map([[currentWindow, 1]]));
            return { limited: false };
        }

        const clientWindows = this.windows.get(clientId);
        this._cleanupOldWindows(clientId);

        // Get current window count
        const currentCount = clientWindows.get(currentWindow) || 0;
        
        // Get previous window count and calculate weighted count
        const previousWindow = currentWindow - 1;
        const previousCount = clientWindows.get(previousWindow) || 0;
        
        // Calculate the weighted count (partial count from previous window)
        const timeInCurrentWindow = Date.now() % this.windowSizeMs;
        const previousWindowWeight = timeInCurrentWindow / this.windowSizeMs;
        const weightedCount = currentCount + (previousCount * previousWindowWeight);

        if (weightedCount >= this.maxRequests) {
            // Block the client for the window duration
            const blockExpiry = Date.now() + this.windowSizeMs;
            this.blockedClients.set(clientId, blockExpiry);

            return {
                limited: true,
                reason: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(this.windowSizeMs / 1000),
                currentCount: Math.ceil(weightedCount),
                maxRequests: this.maxRequests
            };
        }

        // Update current window count
        clientWindows.set(currentWindow, currentCount + 1);
        return { 
            limited: false,
            currentCount: Math.ceil(weightedCount),
            maxRequests: this.maxRequests
        };
    }

    getClientStats(clientId) {
        const clientWindows = this.windows.get(clientId);
        if (!clientWindows) return null;

        const currentWindow = this._getCurrentWindow();
        const currentCount = clientWindows.get(currentWindow) || 0;
        const previousCount = clientWindows.get(currentWindow - 1) || 0;
        const isBlocked = this._isClientBlocked(clientId);
        const blockExpiry = this.blockedClients.get(clientId);

        return {
            currentWindowCount: currentCount,
            previousWindowCount: previousCount,
            maxRequests: this.maxRequests,
            windowSizeMs: this.windowSizeMs,
            isBlocked,
            blockExpiry: blockExpiry ? new Date(blockExpiry).toISOString() : null,
            retryAfter: isBlocked ? Math.ceil((blockExpiry - Date.now()) / 1000) : null
        };
    }

    resetClient(clientId) {
        this.windows.delete(clientId);
        this.blockedClients.delete(clientId);
    }

    resetAll() {
        this.windows.clear();
        this.blockedClients.clear();
    }

    getCurrentCount(clientId) {
        const clientWindows = this.windows.get(clientId);
        if (!clientWindows) return 0;

        const currentWindow = this._getCurrentWindow();
        const currentCount = clientWindows.get(currentWindow) || 0;
        const previousCount = clientWindows.get(currentWindow - 1) || 0;
        
        const timeInCurrentWindow = Date.now() % this.windowSizeMs;
        const previousWindowWeight = timeInCurrentWindow / this.windowSizeMs;
        
        return Math.ceil(currentCount + (previousCount * previousWindowWeight));
    }

    getGlobalStats() {
        return {
            totalClients: this.windows.size,
            blockedClients: this.blockedClients.size,
            windowSizeMs: this.windowSizeMs,
            maxRequests: this.maxRequests
        };
    }
}

module.exports = SlidingWindowCounter; 