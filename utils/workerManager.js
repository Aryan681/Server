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
      this.idleWorkers.push(worker);
      this._processQueue();
    });
    worker.on('error', (err) => {
      const { reject } = this.activeWorkers.get(worker.threadId) || {};
      if (reject) reject(err);
      this.activeWorkers.delete(worker.threadId);
   
      this._createWorker();
      this._processQueue();
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
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ data, resolve, reject });
      this._processQueue();
    });
  }
}

module.exports = WorkerManager; 