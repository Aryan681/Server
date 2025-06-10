const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

class WorkerManager {
  constructor() { 
    this.maxWorkers = Math.max(1, os.cpus().length - 1);
    this.idleWorkers = [];
    this.activeWorkers = new Map();
    this.taskQueue = [];
    this.workerFile = path.resolve(__dirname, 'workerTask.js');
    this.workerId = 0;
    this.isShuttingDown = false;
    this._initPool();
  }

  _initPool() {
    for (let i = 0; i < this.maxWorkers; i++) {
      this._createWorker();
    }
  }

  _createWorker() {
    const worker = new Worker(this.workerFile, {
      workerData: { workerId: this.workerId++ }
    });
    worker.on('message', (result) => {
      const { resolve } = this.activeWorkers.get(worker.threadId) || {};
      if (resolve) resolve(result);
      this.activeWorkers.delete(worker.threadId);
      if (!this.isShuttingDown) {
        this.idleWorkers.push(worker);
        this._processQueue();
      }
    });
    worker.on('error', (err) => {
      const { reject } = this.activeWorkers.get(worker.threadId) || {};
      if (reject) reject(err);
      this.activeWorkers.delete(worker.threadId);
      
      if (!this.isShuttingDown) {
        this._createWorker();
        this._processQueue();
      }
    });
    this.idleWorkers.push(worker);
  }

  _processQueue() {
    if (this.taskQueue.length === 0 || this.idleWorkers.length === 0) return;
    const { data, resolve, reject } = this.taskQueue.shift();
    const worker = this.idleWorkers.shift();
    this.activeWorkers.set(worker.threadId, { resolve, reject });
    worker.postMessage(data);
  }

  executeTask(data) {
    if (this.isShuttingDown) {
      return Promise.reject(new Error('Worker pool is shutting down'));
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ data, resolve, reject });
      this._processQueue();
    });
  }

  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('Shutting down worker pool...');

    // Reject all queued tasks
    while (this.taskQueue.length > 0) {
      const { reject } = this.taskQueue.shift();
      reject(new Error('Worker pool is shutting down'));
    }

    // Wait for active workers to complete their tasks
    const activeWorkerPromises = Array.from(this.activeWorkers.values())
      .map(({ resolve, reject }) => {
        return new Promise((resolveWorker) => {
          // Give workers a chance to complete their tasks
          setTimeout(() => {
            reject(new Error('Worker pool shutdown timeout'));
            resolveWorker();
          }, 5000); // 5 second timeout
        });
      });

    // Terminate all workers
    const terminatePromises = [
      ...this.idleWorkers,
      ...Array.from(this.activeWorkers.keys()).map(threadId => {
        const worker = this.idleWorkers.find(w => w.threadId === threadId) ||
                     Array.from(this.activeWorkers.values())
                       .find(({ worker }) => worker.threadId === threadId)?.worker;
        return worker?.terminate();
      })
    ].filter(Boolean);

    try {
      await Promise.all([
        ...activeWorkerPromises,
        ...terminatePromises
      ]);
    } catch (error) {
      console.error('Error during worker pool shutdown:', error);
    }

    // Clear all collections
    this.idleWorkers = [];
    this.activeWorkers.clear();
    this.taskQueue = [];
    
    console.log('Worker pool shutdown complete');
  }

  getStats() {
    return {
      maxWorkers: this.maxWorkers,
      idleWorkers: this.idleWorkers.length,
      activeWorkers: this.activeWorkers.size,
      queuedTasks: this.taskQueue.length,
      isShuttingDown: this.isShuttingDown
    };
  }
}

module.exports = WorkerManager; 