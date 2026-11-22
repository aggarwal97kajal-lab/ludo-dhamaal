// Friends: friend codes, who is online, invites and this week's wins.
// One Durable Object ("hub") keeps everyone's small record. No accounts: each phone keeps a
// secret key, and its friend code is made from that key, so only that phone can use the code.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ONLINE_MS = 75 * 1000;
const INVITE_MS = 15 * 60 * 1000;
const MAX_FRIENDS = 100;

export async function codeOf(key) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pitara:' + key)));
  let c = ''; for (let i = 0; i < 6; i++) c += ALPHA[h[i] % ALPHA.length];
  return c;
}
// Weeks start on Monday (India time).
export function weekId(t = Date.now()) { return Math.floor((Math.floor((t + 5.5 * 36e5) / 864e5) + 3) / 7); }
const cleanName = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Player';
const num = (v, lo, hi, d) => (Number.isInteger(+v) && +v >= lo && +v <= hi ? +v : d);

export class Hub {
  constructor(state) { this.state = state; this.mem = new Map(); }
  async get(code) {
    if (this.mem.has(code)) return this.mem.get(code);
    const u = (await this.state.storage.get('u:' + code)) || null;
    if (u) this.mem.set(code, u);
    return u;
  }
  async put(u) { this.mem.set(u.code, u); await this.state.storage.put('u:' + u.code, u); }
  week(u) { const w = weekId(); if (!u.week || u.week.id !== w) u.week = { id: w, w: 0, p: 0 }; return u.week; }
  pub(u, now) {
    const on = now - (u.seen || 0) < ONLINE_MS;
    const wk = u.week && u.week.id === weekId() ? u.week : { w: 0, p: 0 };
    return { code: u.code, name: u.name, look: u.look, tint: u.tint, fr: u.fr, online: on, seen: u.seen || 0, room: on && u.room && now - u.room.at < ONLINE_MS ? u.room : null, w: wk.w, p: wk.p, photo: u.photo || null };
  }

  async fetch(req) {
    const url = new URL(req.url);
    let b = {}; try { b = await req.json(); } catch (e) { /* empty */ }
    const key = String(b.key || '');
    if (key.length < 16 || key.length > 64) return J({ error: 'bad key' }, 400);
    const code = await codeOf(key), now = Date.now();
    let me = await this.get(code);
    if (!me) me = { code, name: 'Player', look: 0, tint: 0, fr: 'fr0', friends: [], inbox: [], made: now };
    const path = url.pathname;

    if (path === '/hub/hello') {
      me.name = cleanName(b.name); me.look = num(b.look, 0, 7, 0); me.tint = num(b.tint, 0, 3, 0);
      me.fr = /^fr[0-5]$/.test(b.fr) ? b.fr : 'fr0';
      me.seen = now;
      const r = b.room;
      me.room = r && /^[A-Z0-9]{5}$/.test(r.code) ? { code: r.code, game: String(r.game || '').slice(0, 10), open: !!r.open, playing: !!r.playing, at: now } : null;
      // A small square photo (optional), so friends see your face in the list.
      if (typeof b.photo === 'string') me.photo = b.photo.startsWith('data:image/') && b.photo.length < 9000 ? b.photo : null;
      this.week(me);
      me.inbox = (me.inbox || []).filter(x => now - x.at < INVITE_MS);
      const inbox = me.inbox; me.inbox = [];
      await this.put(me);
      const list = [];
      for (const c of me.friends) { const f = await this.get(c); if (f) list.push(this.pub(f, now)); }
      return J({ me: this.pub(me, now), friends: list, inbox });
    }
    if (path === '/hub/add') {
      const want = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (want === code) return J({ error: 'This is your own code.' });
      const f = await this.get(want);
      if (!f) return J({ error: 'No player with this code. Check the code and try again.' });
      if (!me.friends.includes(want)) { if (me.friends.length >= MAX_FRIENDS) return J({ error: 'You have too many friends already.' }); me.friends.push(want); }
      if (!f.friends.includes(code) && f.friends.length < MAX_FRIENDS) f.friends.push(code);
      me.seen = me.seen || now;
      await this.put(me); await this.put(f);
      return J({ ok: true, friend: this.pub(f, now) });
    }
    if (path === '/hub/remove') {
      const c = String(b.code || '');
      me.friends = me.friends.filter(x => x !== c); await this.put(me);
      const f = await this.get(c); if (f) { f.friends = f.friends.filter(x => x !== code); await this.put(f); }
      return J({ ok: true });
    }
    if (path === '/hub/invite') {
      // Invite a friend to your room, or just "ping" them to come and play.
      const f = await this.get(String(b.to || ''));
      if (!f || !me.friends.includes(f.code)) return J({ error: 'Not your friend' });
      const room = /^[A-Z0-9]{5}$/.test(b.room) ? b.room : null;
      const last = (f.inbox || []).find(x => x.from === code);
      if (last && now - last.at < 8000) return J({ ok: true });
      f.inbox = (f.inbox || []).filter(x => x.from !== code || (room && x.room !== room)).slice(-9);
      f.inbox.push({ from: code, name: me.name, look: me.look, tint: me.tint, room, game: String(b.game || '').slice(0, 10), at: now, tour: b.tour ? String(b.tour).slice(0, 12) : undefined });
      await this.put(f);
      return J({ ok: true });
    }
    if (path === '/hub/result') {
      const wk = this.week(me); wk.p++; if (b.won) wk.w++;
      me.seen = now; await this.put(me);
      return J({ ok: true, week: wk });
    }
    return J({ error: 'not found' }, 404);
  }
}
function J(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } }); }
