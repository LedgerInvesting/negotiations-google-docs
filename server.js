const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach WebSocket server to the same HTTP server (upgrade path)
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');

    ws.on('message', (message) => {
      console.log('[WS] Received:', message.toString());
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[WS] Error:', error);
    });
  });

  // Store reference for broadcasting
  global.wsServer = wss;

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server attached to the same port`);
  });
});
