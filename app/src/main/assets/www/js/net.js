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

  // Phones switch between Wi-Fi and mobile data on their own. The old connection then dies
  // without telling anyone, so check quickly whenever the network or the app state changes.
  static watchNetwork(net) {
    const check = () => net.probe();
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    const c = navigator.connection; if (c && c.addEventListener) c.addEventListener('change', check);
  }

  // Ask the server for an answer now. No answer in 3 seconds: open a new connection.
  probe() {
    if (this.closedByUser || !this.code) return;
    const ws = this.ws;
    if (!ws || ws.readyState > 1) { this.open(); return; }
    if (ws.readyState !== 1) return;
    const asked = Date.now();
    this.send({ t: 'ping' });
    clearTimeout(this.probeTimer);
    this.probeTimer = setTimeout(() => { if (this.ws === ws && this.lastMsg < asked && !this.closedByUser) this.reopen(); }, 3000);
  }

  reopen() {
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onclose = null; ws.onmessage = null; try { ws.close(); } catch (x) { /* ignore */ } }
    this.h.status && this.h.status('reconnecting');
    this.open();
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
    // A connection that does not open in 7 seconds is tried again.
    const openTimer = setTimeout(() => { if (this.ws === ws && ws.readyState === 0) { try { ws.close(); } catch (x) { /* ignore */ } } }, 7000);
    ws.onopen = () => { clearTimeout(openTimer); this.retry = 0; this.lastMsg = Date.now(); this.send({ t: 'hello', ...this.hello }); this.h.status && this.h.status('online'); };
    ws.onmessage = e => { this.lastMsg = Date.now(); let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.h.message(m); };
    // Heartbeat: a connection that went silent (common when mobile data drops) is reopened.
    clearInterval(this.beat);
    this.beat = setInterval(() => {
      if (this.ws !== ws || this.closedByUser) { clearInterval(this.beat); return; }
      if (ws.readyState === 1) {
        this.send({ t: 'ping' });
        if (Date.now() - this.lastMsg > 11000) this.reopen();
      }
    }, 4000);
    ws.onclose = () => {
      clearTimeout(openTimer);
      if (this.ws !== ws) return;
      if (this.closedByUser) return;
      this.h.status && this.h.status('reconnecting');
      // First try again at once, then wait a little longer each time (at most 4 seconds).
      const wait = this.retry === 0 ? 0 : Math.min(4000, 500 * Math.pow(1.7, this.retry));
      this.retry++;
      clearTimeout(this.reTimer);
      this.reTimer = setTimeout(() => { if (!this.closedByUser && this.ws === ws) this.open(); }, wait);
    };
    ws.onerror = () => { try { ws.close(); } catch (x) { /* ignore */ } };
  }

  send(m) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }

  close() {
    this.closedByUser = true;
    clearInterval(this.beat);
    if (this.ws) { try { this.send({ t: 'leave' }); this.ws.close(); } catch (x) { /* ignore */ } }
    this.ws = null;
  }
}
