class SlidingWindowCounter {
    constructor(windowSizeMs = 60000, maxRequests = 100) {
        this.windowSizeMs = windowSizeMs; // 1 minute default
        this.maxRequests = maxRequests;
        this.windows = new Map(); // Map of client IP to their request windows
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

    isRateLimited(clientId) {
        const currentWindow = this._getCurrentWindow();
        
        if (!this.windows.has(clientId)) {
            this.windows.set(clientId, new Map([[currentWindow, 1]]));
            return false;
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
            return true;
        }

        // Update current window count
        clientWindows.set(currentWindow, currentCount + 1);
        return false;
    }

    getClientStats(clientId) {
        const clientWindows = this.windows.get(clientId);
        if (!clientWindows) return null;

        const currentWindow = this._getCurrentWindow();
        const currentCount = clientWindows.get(currentWindow) || 0;
        const previousCount = clientWindows.get(currentWindow - 1) || 0;

        return {
            currentWindowCount: currentCount,
            previousWindowCount: previousCount,
            maxRequests: this.maxRequests,
            windowSizeMs: this.windowSizeMs
        };
    }
}

module.exports = SlidingWindowCounter; 