// Live voice chat: every player connects to every other player (WebRTC mesh, max 4 people).
// Signalling messages go through the room server.
const ICE = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

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
  }

  async start(me, wantMic) {
    this.me = me;
    if (!this.local) {
      try {
        this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        this.local = null;
      }
    }
    this.setMuted(!wantMic);
    if (!this.timer) this.timer = setInterval(() => this.levels(), 200);
    return !!this.local;
  }

  hasMic() { return !!this.local; }

  setMuted(m) {
    this.muted = m;
    if (this.local) this.local.getAudioTracks().forEach(t => { t.enabled = !m; });
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

  makePeer(pid) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { pc, audio: null, an: null, speaking: false };
    this.peers.set(pid, peer);
    if (this.local) this.local.getTracks().forEach(t => pc.addTrack(t, this.local));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = e => { if (e.candidate) this.send(pid, { ice: e.candidate }); };
    pc.ontrack = e => {
      const a = new Audio(); a.autoplay = true; a.srcObject = e.streams[0];
      a.muted = this.deafened.has(pid) || this.allOff;
      peer.audio = a; a.play().catch(() => {});
      try {
        this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
        const src = this.ac.createMediaStreamSource(e.streams[0]); const an = this.ac.createAnalyser(); an.fftSize = 256; src.connect(an); peer.an = an;
      } catch (x) { /* level meter is optional */ }
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && this.me < pid) { this.drop(pid); this.call(pid); } };
    return peer;
  }

  async call(pid) {
    const { pc } = this.makePeer(pid);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send(pid, { sdp: pc.localDescription });
  }

  async signal(from, data) {
    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        if (this.peers.has(from)) this.drop(from);
        const { pc } = this.makePeer(from);
        await pc.setRemoteDescription(data.sdp);
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        this.send(from, { sdp: pc.localDescription });
      } else {
        const p = this.peers.get(from); if (p) await p.pc.setRemoteDescription(data.sdp);
      }
    } else if (data.ice) {
      const p = this.peers.get(from);
      if (p) { try { await p.pc.addIceCandidate(data.ice); } catch (e) { /* late candidate */ } }
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
      try { this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)(); const src = this.ac.createMediaStreamSource(this.local); this.localAn = this.ac.createAnalyser(); this.localAn.fftSize = 256; src.connect(this.localAn); } catch (x) { this.localAn = null; }
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
    if (p) { try { p.pc.close(); } catch (e) { /* ignore */ } if (p.audio) p.audio.srcObject = null; }
    this.peers.delete(pid);
  }

  stop() {
    for (const pid of [...this.peers.keys()]) this.drop(pid);
    if (this.local) this.local.getTracks().forEach(t => t.stop());
    this.local = null; this.localAn = null;
    if (this.timer) clearInterval(this.timer); this.timer = null;
  }
}
