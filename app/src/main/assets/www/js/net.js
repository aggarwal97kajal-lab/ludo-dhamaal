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

  join(code, hello) {
    this.code = code; this.hello = hello; this.closedByUser = false;
    this.open();
  }

  open() {
    const base = Net.serverBase().replace(/^http/, 'ws');
    const ws = new WebSocket(base + '/room/' + encodeURIComponent(this.code));
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.send({ t: 'hello', ...this.hello }); this.h.status && this.h.status('online'); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.h.message(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.closedByUser) return;
      this.h.status && this.h.status('reconnecting');
      const wait = Math.min(8000, 800 * Math.pow(1.6, this.retry++));
      setTimeout(() => { if (!this.closedByUser) this.open(); }, wait);
    };
    ws.onerror = () => { try { ws.close(); } catch (x) { /* ignore */ } };
  }

  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }

  close() {
    this.closedByUser = true;
    if (this.ws) { try { this.send({ t: 'leave' }); this.ws.close(); } catch (x) { /* ignore */ } }
    this.ws = null;
  }
}
