// Live voice chat: every player connects to every other player (WebRTC mesh, max 4 people).
// Signalling messages go through the room server.
let ICE = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
export let RELAY = false;

// Ask the room server for relay (TURN) servers so voice works on mobile networks too.
export async function loadIce(base) {
  if (!base) return;
  try {
    const r = await fetch(base + '/turn');
    if (!r.ok) return;
    const j = await r.json();
    const list = Array.isArray(j.iceServers) ? j.iceServers : (j.iceServers ? [j.iceServers] : []);
    const clean = list.map(x => ({ ...x, urls: [].concat(x.urls || []).filter(u => !/:53(\?|$)/.test(u)) })).filter(x => x.urls.length);
    if (clean.length) { ICE = ICE.concat(clean); RELAY = clean.some(x => x.urls.some(u => u.startsWith('turn'))); }
  } catch (e) { /* STUN only */ }
}

export class Voice {
  constructor(send, onSpeaking) {
    this.send = send;           // (toPid, data) => void
    this.onSpeaking = onSpeaking; // (pid, bool) => void
    this.me = null;
    this.peers = new Map();     // pid -> { pc, audio, an }
    this.local = null;
    this.muted = true;
    this.deafened = new Set();
    this.ac = null;
    this.timer = null;
    this.raw = null;            // the real mic
    this.micGain = null;        // my mic volume (Web Audio gain between the mic and the call)
    this.voiceVol = 1;          // friends' voice volume 0..1
    this.micVol = 1;            // 0..2
  }

  // Friends' voice volume, 0..1
  setVoiceVolume(x) {
    this.voiceVol = Math.max(0, Math.min(1, x));
    for (const [, p] of this.peers) if (p.audio) p.audio.volume = this.voiceVol;
  }
  // My mic volume, 0..2 (1 = normal)
  setMicVolume(x) {
    this.micVol = Math.max(0, Math.min(2, x));
    if (this.micGain) this.micGain.gain.value = this.micVol;
  }

  async start(me, wantMic) {
    const had = !!this.local;
    if (!this.local) {
      try {
        this.raw = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        this.local = this.raw;
        // Send the mic through a volume control. If that does not work on this phone, send it as it is.
        try {
          this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
          if (this.ac.state === 'suspended') await Promise.race([this.ac.resume(), new Promise(r => setTimeout(r, 800))]);
          if (this.ac.state === 'running') {
            const src = this.ac.createMediaStreamSource(this.raw), g = this.ac.createGain(), out = this.ac.createMediaStreamDestination();
            g.gain.value = this.micVol; src.connect(g); g.connect(out);
            this.micGain = g; this.local = out.stream;
          }
        } catch (x) { this.local = this.raw; this.micGain = null; }
      } catch (e) {
        this.local = null; this.raw = null;
      }
    }
    // Only start calling people once we know whether we have a mic, so our voice is
    // part of every call from the beginning.
    const first = !this.me;
    this.me = me;
    this.setMuted(!wantMic);
    if (!first && !had && this.local) this.restart();
    if (!this.timer) this.timer = setInterval(() => this.levels(), 200);
    return !!this.local;
  }

  hasMic() { return !!this.local; }

  state(pid) { const p = this.peers.get(pid); return p ? p.pc.connectionState : 'none'; }

  setMuted(m) {
    this.muted = m;
    if (this.local) this.local.getAudioTracks().forEach(t => { t.enabled = !m; });
    if (this.raw && this.raw !== this.local) this.raw.getAudioTracks().forEach(t => { t.enabled = !m; });
  }

  // Keep connections in line with the people in the room.
  sync(pids) {
    if (!this.me) return;
    for (const [pid, p] of this.peers) {
      if (!pids.includes(pid)) { this.drop(pid); continue; }
      const st = p.pc.connectionState;
      if ((st === 'failed' || st === 'closed') && this.me < pid) { this.drop(pid); }
    }
    pids.forEach(pid => {
      if (pid === this.me || this.peers.has(pid)) return;
      if (this.me < pid) this.call(pid);
    });
  }

  makePeer(pid, cid) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { pc, cid, audio: null, an: null, speaking: false };
    this.peers.set(pid, peer);
    if (this.local) this.local.getTracks().forEach(t => pc.addTrack(t, this.local));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = e => { if (e.candidate) this.send(pid, { ice: e.candidate, cid }); };
    pc.ontrack = e => {
      if (peer.audio) { peer.audio.srcObject = null; peer.audio.remove(); }
      const a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.srcObject = e.streams[0];
      a.style.display = 'none'; document.body.appendChild(a);
      if (window.LDNative && window.LDNative.speaker) window.LDNative.speaker();
      a.muted = this.deafened.has(pid) || this.allOff;
      a.volume = this.voiceVol;
      peer.audio = a; a.play().catch(() => {});
      try {
        this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
        const src = this.ac.createMediaStreamSource(e.streams[0]); const an = this.ac.createAnalyser(); an.fftSize = 256; src.connect(an); peer.an = an;
      } catch (x) { /* level meter is optional */ }
    };
    pc.onconnectionstatechange = () => {
      if (this.onState) this.onState(pid, pc.connectionState);
      if (pc.connectionState === 'failed' && this.me < pid) { this.drop(pid); this.call(pid); }
      // A call that stays broken for a few seconds is rebuilt from scratch.
      if (pc.connectionState === 'disconnected') setTimeout(() => { if (this.peers.get(pid) && this.peers.get(pid).pc === pc && pc.connectionState !== 'connected') this.restart([pid]); }, 5000);
    };
    return peer;
  }

  async call(pid) {
    const cid = Math.random().toString(36).slice(2, 10);
    const { pc } = this.makePeer(pid, cid);
    // If the call has not connected after a while (a lost message), start it again.
    setTimeout(() => { const p = this.peers.get(pid); if (p && p.pc === pc && pc.connectionState !== 'connected') this.restart([pid]); }, 9000);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send(pid, { sdp: pc.localDescription, cid });
  }

  // Rebuild every call (used when the mic becomes available after calls started).
  restart(pids) {
    if (!this.me) return;
    const list = pids || [...this.peers.keys()];
    for (const pid of list) {
      if (pid === this.me) continue;
      // Only the player with the smaller id starts a call, so two calls never cross.
      this.drop(pid);
      if (this.me < pid) this.call(pid);
    }
  }

  async signal(from, data) {
    if (!this.me) return;
    if (data.redo) { this.drop(from); this.call(from); return; }
    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        if (this.peers.has(from)) this.drop(from);
        const { pc } = this.makePeer(from, data.cid);
        await pc.setRemoteDescription(data.sdp);
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        this.send(from, { sdp: pc.localDescription, cid: data.cid });
      } else {
        const p = this.peers.get(from);
        if (p && p.cid === data.cid && p.pc.signalingState === 'have-local-offer') await p.pc.setRemoteDescription(data.sdp);
      }
    } else if (data.ice) {
      const p = this.peers.get(from);
      if (p && p.cid === data.cid) { try { await p.pc.addIceCandidate(data.ice); } catch (e) { /* late candidate */ } }
    }
  }

  setListen(on) {
    this.allOff = !on;
    for (const [pid, p] of this.peers) if (p.audio) p.audio.muted = !on || this.deafened.has(pid);
  }

  toggleDeafen(pid) {
    if (this.deafened.has(pid)) this.deafened.delete(pid); else this.deafened.add(pid);
    const p = this.peers.get(pid); if (p && p.audio) p.audio.muted = this.deafened.has(pid) || this.allOff;
    return this.deafened.has(pid);
  }

  levels() {
    const buf = new Uint8Array(128);
    for (const [pid, p] of this.peers) {
      if (!p.an) continue;
      p.an.getByteTimeDomainData(buf);
      let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128));
      const s = m > 10;
      if (s !== p.speaking) { p.speaking = s; this.onSpeaking(pid, s); }
    }
    if (this.local && !this.localAn) {
      try { this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)(); const src = this.ac.createMediaStreamSource(this.raw || this.local); this.localAn = this.ac.createAnalyser(); this.localAn.fftSize = 256; src.connect(this.localAn); } catch (x) { this.localAn = null; }
    }
    if (this.localAn) {
      this.localAn.getByteTimeDomainData(buf);
      let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128));
      const s = m > 10 && !this.muted;
      if (s !== this.localSpeaking) { this.localSpeaking = s; this.onSpeaking(this.me, s); }
    }
  }

  drop(pid) {
    const p = this.peers.get(pid);
    if (p) { try { p.pc.close(); } catch (e) { /* ignore */ } if (p.audio) { p.audio.srcObject = null; p.audio.remove(); } }
    this.peers.delete(pid);
  }

  stop() {
    for (const pid of [...this.peers.keys()]) this.drop(pid);
    if (this.local) this.local.getTracks().forEach(t => t.stop());
    if (this.raw) this.raw.getTracks().forEach(t => t.stop());
    this.local = null; this.raw = null; this.micGain = null; this.localAn = null;
    if (this.timer) clearInterval(this.timer); this.timer = null;
  }
}
