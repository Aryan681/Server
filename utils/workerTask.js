const { parentPort, workerData } = require('worker_threads');

parentPort.on('message', async (data) => {
  // Simulate CPU-intensive work
  await new Promise(resolve => setTimeout(resolve, 100));
  parentPort.postMessage({
    processed: true,
    data,
    workerId: workerData.workerId
  });
}); 