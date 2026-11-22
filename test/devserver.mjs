// Tiny local stand-in for the Cloudflare Worker, for testing online play.
import http from 'node:http';
import crypto from 'node:crypto';
import { Room } from '../server/src/index.js';
import { Hub } from '../server/src/hub.js';
const store = new Map();
const hub = new Hub({ storage: { get: async k => store.get(k), put: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); } } });
const rooms = new Map();
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const room = code => { if (!rooms.has(code)) { const r = new Room({}, {}); r.code = code; rooms.set(code, r); } return rooms.get(code); };
const srv = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/new') { let c = ''; for (let i = 0; i < 5; i++) c += CHARS[Math.floor(Math.random() * CHARS.length)]; room(c).claimed = true; res.end(JSON.stringify({ code: c })); return; }
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.end(); return; }
  if (req.url.startsWith('/hub/')) { let body = ''; req.on('data', d => { body += d; }); req.on('end', async () => { const r = await hub.fetch(new Request('https://hub' + req.url, { method: 'POST', body })); res.setHeader('content-type', 'application/json'); res.end(await r.text()); }); return; }
  if (req.url === '/turn') { res.end(JSON.stringify({ iceServers: [] })); return; }
  res.end('{"ok":true}');
});
srv.on('upgrade', (req, sock) => {
  const m = req.url.match(/^\/room\/([A-Z0-9]{5})$/); if (!m) return sock.destroy();
  const key = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\n\r\n`);
  const r = room(m[1]);
  const ws = { send(t) { const b = Buffer.from(t); let h; if (b.length < 126) h = Buffer.from([0x81, b.length]); else if (b.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(b.length, 2); } else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(b.length), 2); } sock.write(Buffer.concat([h, b])); }, close() { sock.end(); } };
  let buf = Buffer.alloc(0);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const op = buf[0] & 15; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + 4 + len) return;
      const mask = buf.slice(off, off + 4), data = Buffer.from(buf.slice(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
      buf = buf.slice(off + 4 + len);
      if (op === 8) { r.onClose(ws); sock.end(); return; }
      if (op === 1) r.onMsg(ws, data.toString());
    }
  });
  sock.on('close', () => r.onClose(ws)); sock.on('error', () => r.onClose(ws));
});
srv.listen(8787, () => console.log('dev server on 8787'));
