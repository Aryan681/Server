class RequestQueue {
    constructor(maxQueueSize = 1000) {
        this.maxQueueSize = maxQueueSize;
        this.queue = [];
        this.processing = false;
    }

    async add(request, priority = 0) {
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error('Request queue is full');
        }

        return new Promise((resolve, reject) => {
            const queueItem = {
                request,
                priority,
                resolve,
                reject,
                timestamp: Date.now()
            };

            // Insert based on priority (higher priority first)
            const insertIndex = this.queue.findIndex(item => item.priority < priority);
            if (insertIndex === -1) {
                this.queue.push(queueItem);
            } else {
                this.queue.splice(insertIndex, 0, queueItem);
            }

            // Start processing if not already processing
            if (!this.processing) {
                this.process();
            }
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            try {
                const result = await item.request();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }

        this.processing = false;
    }

    getQueueStats() {
        return {
            queueLength: this.queue.length,
            maxQueueSize: this.maxQueueSize,
            isProcessing: this.processing
        };
    }

    clear() {
        this.queue = [];
        this.processing = false;
    }
}

module.exports = RequestQueue; 