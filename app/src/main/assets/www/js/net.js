// Connection to the online room server (Cloudflare Worker + Durable Object).
export class Net {
  constructor(handlers) {
    this.h = handlers;
    this.ws = null;
    this.code = null;
    this.closedByUser = false;
    this.retry = 0;
  }

  static serverBase() {
    const c = window.LD_CONFIG || {};
    return (c.server || '').replace(/\/$/, '');
  }

  static async newCode() {
    const base = Net.serverBase();
    if (!base) throw new Error('Online server is not set up yet.');
    const r = await fetch(base + '/new', { method: 'POST' });
    if (!r.ok) throw new Error('Could not create a room. Try again.');
    return (await r.json()).code;
  }

  static watchNetwork(net) {
    window.addEventListener('online', () => {
      if (net.closedByUser || (net.ws && net.ws.readyState <= 1)) return;
      net.open();
    });
  }

  join(code, hello) {
    this.code = code; this.hello = hello; this.closedByUser = false;
    if (!this.watching) { this.watching = true; Net.watchNetwork(this); }
    this.open();
  }

  open() {
    clearTimeout(this.reTimer);
    const base = Net.serverBase().replace(/^http/, 'ws');
    const ws = new WebSocket(base + '/room/' + encodeURIComponent(this.code));
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.lastMsg = Date.now(); this.send({ t: 'hello', ...this.hello }); this.h.status && this.h.status('online'); };
    ws.onmessage = e => { this.lastMsg = Date.now(); let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.h.message(m); };
    // Heartbeat: a connection that went silent (common when mobile data drops) is reopened.
    clearInterval(this.beat);
    this.beat = setInterval(() => {
      if (this.ws !== ws || this.closedByUser) { clearInterval(this.beat); return; }
      if (ws.readyState === 1) {
        this.send({ t: 'ping' });
        if (Date.now() - this.lastMsg > 20000) { try { ws.close(); } catch (x) { /* ignore */ } }
      }
    }, 7000);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.closedByUser) return;
      this.h.status && this.h.status('reconnecting');
      const wait = Math.min(8000, 800 * Math.pow(1.6, this.retry++));
      clearTimeout(this.reTimer);
      this.reTimer = setTimeout(() => { if (!this.closedByUser && this.ws === ws) this.open(); }, wait);
    };
    ws.onerror = () => { try { ws.close(); } catch (x) { /* ignore */ } };
  }

  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  close() {
    this.closedByUser = true;
    clearInterval(this.beat);
    if (this.ws) { try { this.send({ t: 'leave' }); this.ws.close(); } catch (x) { /* ignore */ } }
    this.ws = null;
  }
}
