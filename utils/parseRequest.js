class RequestParseError extends Error {
    constructor(message, code = 'BAD_REQUEST') {
        super(message);
        this.name = 'RequestParseError';
        this.code = code;
    }
}

function parseRequest(rawData) {
    try {
        if (!rawData || !Buffer.isBuffer(rawData)) {
            throw new RequestParseError('Invalid request data', 'INVALID_DATA');
        }

        const requestString = rawData.toString();
        if (!requestString.trim()) {
            throw new RequestParseError('Empty request', 'EMPTY_REQUEST');
        }

        const lines = requestString.split("\r\n");
        if (lines.length === 0) {
            throw new RequestParseError('No request lines found', 'INVALID_FORMAT');
        }

        // Parse request line
        const [requestLine, ...headerLines] = lines;
        const requestParts = requestLine.split(" ");
        
        if (requestParts.length !== 3) {
            throw new RequestParseError('Invalid request line format', 'INVALID_REQUEST_LINE');
        }

        const [method, path, version] = requestParts;

        // Validate HTTP method
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        if (!validMethods.includes(method)) {
            throw new RequestParseError(`Invalid HTTP method: ${method}`, 'INVALID_METHOD');
        }

        // Validate HTTP version
        if (!version.startsWith('HTTP/')) {
            throw new RequestParseError(`Invalid HTTP version: ${version}`, 'INVALID_VERSION');
        }

        // Parse headers
        const headers = {};
        let i = 0;
        let contentLength = 0;

        for (; i < headerLines.length; i++) {
            const line = headerLines[i];
            if (line === "") break;

            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) {
                throw new RequestParseError(`Invalid header format: ${line}`, 'INVALID_HEADER');
            }

            const key = line.slice(0, colonIndex).trim().toLowerCase();
            const value = line.slice(colonIndex + 1).trim();

            if (!key || !value) {
                throw new RequestParseError(`Empty header key or value: ${line}`, 'INVALID_HEADER');
            }

            headers[key] = value;

            // Track content length
            if (key === 'content-length') {
                contentLength = parseInt(value, 10);
                if (isNaN(contentLength) || contentLength < 0) {
                    throw new RequestParseError('Invalid Content-Length header', 'INVALID_CONTENT_LENGTH');
                }
            }
        }

        // Parse body
        let body = '';
        if (contentLength > 0) {
            const remainingData = headerLines.slice(i + 1).join('\r\n');
            if (remainingData.length < contentLength) {
                throw new RequestParseError('Incomplete request body', 'INCOMPLETE_BODY');
            }

            body = remainingData.slice(0, contentLength);

            // Parse JSON body if content-type is application/json
            if (headers['content-type']?.includes('application/json')) {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    throw new RequestParseError('Invalid JSON body', 'INVALID_JSON');
                }
            }
        }

        // Validate path
        if (!path || !path.startsWith('/')) {
            throw new RequestParseError(`Invalid path: ${path}`, 'INVALID_PATH');
        }

        // Validate maximum header size
        const maxHeaderSize = 8192; // 8KB
        if (requestString.length > maxHeaderSize) {
            throw new RequestParseError('Headers too large', 'HEADERS_TOO_LARGE');
        }

        // Validate maximum body size
        const maxBodySize = 1024 * 1024; // 1MB
        if (contentLength > maxBodySize) {
            throw new RequestParseError('Request body too large', 'BODY_TOO_LARGE');
        }

        return {
            method,
            path,
            version,
            headers,
            body,
            raw: requestString
        };
    } catch (error) {
        if (error instanceof RequestParseError) {
            throw error;
        }
        throw new RequestParseError(`Failed to parse request: ${error.message}`, 'PARSE_ERROR');
    }
}

module.exports = parseRequest;
