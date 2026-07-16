const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CHANNEL_PASSWORD = process.env.CHANNEL_PASSWORD || 'telsiz123';

const MIME = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js':   'application/javascript',
  '.png':  'image/png',
};

const httpServer = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const ext = path.extname(url);
  const filePath = path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server: httpServer });
const clients = new Set();

wss.on('connection', (ws) => {
  ws.authenticated = false;

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (!ws.authenticated) return;
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: true });
        }
      }
      return;
    }

    const msg = JSON.parse(data.toString());

    if (msg.type === 'auth') {
      if (msg.password.trim() === CHANNEL_PASSWORD.trim()) {
        ws.authenticated = true;
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'auth', success: true }));
        console.log(`Kullanıcı doğrulandı. Toplam: ${clients.size}`);
        broadcastInfo();
      } else {
        ws.send(JSON.stringify({ type: 'auth', success: false }));
        ws.close();
      }
      return;
    }

    if (!ws.authenticated) return;

    if (msg.type === 'talking') {
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'talking', state: msg.state }));
        }
      }
    }
  });

  ws.on('close', () => {
    if (ws.authenticated) {
      clients.delete(ws);
      console.log(`Bağlantı kesildi. Toplam: ${clients.size}`);
      broadcastInfo();
    }
  });

  ws.on('error', (err) => console.error('WebSocket hatası:', err.message));
});

function broadcastInfo() {
  const msg = JSON.stringify({ type: 'info', count: clients.size });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Telsiz sunucusu: http://localhost:${PORT}`);
  console.log(`Kanal şifresi: ${CHANNEL_PASSWORD}`);
});
