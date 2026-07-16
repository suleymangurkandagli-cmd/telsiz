const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CHANNEL_PASSWORD = process.env.CHANNEL_PASSWORD || 'telsiz123';

const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server: httpServer });

// Sadece doğrulanmış clientlar
const clients = new Set();

wss.on('connection', (ws) => {
  ws.authenticated = false;

  ws.on('message', (data, isBinary) => {
    // Binary mesaj: ses verisi (sadece authenticated clientlardan kabul et)
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

    // Şifre doğrulama
    if (msg.type === 'auth') {
      if (msg.password === CHANNEL_PASSWORD) {
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
