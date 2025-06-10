const { parentPort, workerData } = require('worker_threads');

parentPort.on('message', async (data) => {
    try {
        // Simulate CPU-intensive work
        await new Promise(resolve => setTimeout(resolve, 100));

        // Always include intensive: true for CPU-intensive tasks
        const result = {
            intensive: true,
            processed: true,
            data: data.body,
            workerId: workerData.workerId,
            timestamp: new Date().toISOString()
        };

        // Send the result back
        parentPort.postMessage({
            statusCode: 200,
            body: result,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        // Handle any errors in the worker
        parentPort.postMessage({
            statusCode: 500,
            body: {
                error: 'Worker processing error',
                message: error.message
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}); 