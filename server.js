const http = require('http');
const fs   = require('fs');
const path = require('path');
const { AccessToken } = require('livekit-server-sdk');

const PORT             = process.env.PORT             || 3000;
const CHANNEL_PASSWORD = process.env.CHANNEL_PASSWORD || 'telsiz123';
const LIVEKIT_URL      = process.env.LIVEKIT_URL      || '';
const LIVEKIT_API_KEY  = process.env.LIVEKIT_API_KEY  || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'application/javascript', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  // Token endpoint
  if (req.method === 'POST' && req.url === '/token') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { password, identity } = JSON.parse(body);
        if (password.trim() !== CHANNEL_PASSWORD.trim()) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'wrong_password' }));
          return;
        }

        const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity: identity || 'kullanici-' + Date.now(),
          ttl: '6h',
        });
        token.addGrant({ room: 'telsiz-kanal', roomJoin: true, canPublish: true, canSubscribe: true });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: await token.toJwt(), url: LIVEKIT_URL }));
      } catch (e) {
        res.writeHead(500);
        res.end('Hata');
      }
    });
    return;
  }

  // Statik dosyalar
  const url      = req.url === '/' ? '/index.html' : req.url;
  const ext      = path.extname(url);
  const filePath = path.join(__dirname, url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Telsiz (LiveKit) sunucusu: http://localhost:${PORT}`);
  console.log(`Kanal şifresi: ${CHANNEL_PASSWORD}`);
});
