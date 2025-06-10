function parseRequest(rawData) {
  const lines = rawData.toString().split("\r\n");
  const [requestLine, ...headerLines] = lines;

  const [method, path, version] = requestLine.split(" ");

  const headers = {};
  let i = 0;

  for (; i < headerLines.length; i++) {
    const line = headerLines[i];
    if (line === "") break;

    const [key, value] = line.split(": ");
    if (key && value) {
      headers[key.toLowerCase()] = value;
    }
  }

  
  let body = '';
  const contentLength = parseInt(headers['content-length'], 10);
  
  if (contentLength) {
    
    const remainingData = headerLines.slice(i + 1).join('\r\n');
    body = remainingData.slice(0, contentLength);
    

    if (headers['content-type']?.includes('application/json')) {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        body = null;
      }
    }
  }

  return {
    method,
    path,
    version,
    headers,
    body,
  };
}

module.exports = parseRequest;
