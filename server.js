const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

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

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Yeni bağlantı. Toplam: ${clients.size}`);

  // Tüm clientlara bağlı kullanıcı sayısını bildir
  broadcastInfo();

  ws.on('message', (data, isBinary) => {
    // Metin mesajı mı (kontrol) yoksa binary (ses) mi?
    if (!isBinary) {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'talking') {
        // Diğer clientlara "şu an konuşuyor" bilgisi gönder
        for (const client of clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'talking', state: msg.state }));
          }
        }
      }
      return;
    }

    // Binary ses verisini diğer clientlara ilet
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: true });
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Bağlantı kesildi. Toplam: ${clients.size}`);
    broadcastInfo();
  });

  ws.on('error', (err) => {
    console.error('WebSocket hatası:', err.message);
  });
});

function broadcastInfo() {
  const msg = JSON.stringify({ type: 'info', count: clients.size });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`Telsiz sunucusu çalışıyor: http://localhost:${PORT}`);
});
