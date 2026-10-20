import {registerRoot, Composition, AbsoluteFill, Sequence, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing} from 'remotion';
import React from 'react';
import P from './project.json';     // copied in by make_video.sh
import CAPS from './captions.json'; // from align.py

const FPS = P.fps || 30;
const SEGS = P.segments;
export const TOTAL = Math.round(SEGS[SEGS.length - 1].end * FPS);
const CAP_END = P.captions_end || 1e9;

const CSS = `
.sc{font-family:'Inter Display','Inter',sans-serif;color:#1A1915}
.grid{position:absolute;inset:0;background-image:radial-gradient(rgba(26,25,21,.10) 2px,transparent 2.5px);background-size:44px 44px}
.e{position:absolute;will-change:transform,opacity}
.h1{font-weight:900;letter-spacing:-.035em;line-height:.95}
.lab{font-family:Inter;font-weight:800;letter-spacing:.14em;color:#D97757;font-size:30px}
.pill{background:#D97757;color:#fff;border-radius:999px;font-weight:800;padding:18px 40px;font-family:Inter}
.card{background:#fff;border-radius:28px;box-shadow:0 18px 50px rgba(26,25,21,.12);padding:34px 38px}
.mark{position:relative;display:inline-block}
.mark>i{position:absolute;left:-6px;right:-6px;bottom:6%;height:34%;background:rgba(217,119,87,.35);border-radius:8px;z-index:-1;transform-origin:left;transform:scaleX(var(--s,0))}
em{font-style:normal;color:#D97757}
.strike{position:relative;display:inline-block}
.strike>b{position:absolute;left:-4%;top:52%;height:12px;background:#D97757;border-radius:6px;width:calc(108% * var(--s,0))}
.step.on .card{background:#D97757;color:#fff;transform:scale(1.06)} .step.on .card svg *{stroke:#fff} .step.on .card div{color:#fff!important}
`;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

const Scene = ({sc}) => {
  const f = useCurrentFrame();
  const t = f / FPS, T = sc.start + t;
  const R = sc.seed || 7;
  const cols = ['rgba(217,119,87,.16)','rgba(217,119,87,.10)','rgba(26,25,21,.05)','rgba(217,119,87,.22)'];
  const blobs = [...Array(6)].map((_, i) => {
    const s = 160 + ((i * 97 + R * 13) % 260), x = ((i * 331 + R * 57) % 1700) + 60, y = ((i * 211 + R * 91) % 860) + 60, sp = .25 + i * .07, ph = i * 1.3;
    return <div key={i} style={{position:'absolute',width:s,height:s,borderRadius:'50%',background:cols[i%4],
      transform:`translate(${x + Math.sin(t*sp+ph)*(40+i*9)}px,${y + Math.cos(t*sp*.8+ph)*(30+i*7)}px)`}}/>;
  });
  const wp = clamp(t / 0.55);
  const wipe = interpolate(wp, [0, 1], [0, 105], {easing: Easing.inOut(Easing.cubic)});
  return (
    <AbsoluteFill className="sc" style={{background:'#F4F1EA'}}>
      <div className="grid"/>{blobs}
      {sc.els.map((s, i) => {
        if (T < s.t) return null;
        const lf = Math.round((T - s.t) * FPS);
        const k = s.anim || 'pop';
        const bouncy = spring({frame: lf, fps: FPS, config: {damping: 11, mass: 0.7, stiffness: 140}});
        const smooth = spring({frame: lf, fps: FPS, config: {damping: 200}, durationInFrames: Math.round((s.d || 0.5) * FPS * 1.4)});
        const out = s.out !== undefined ? clamp((T - s.out) / 0.35) : 0;
        let tr = '', op = 1, html = s.html;
        if (k === 'pop') { tr = `scale(${0.55 + 0.45 * bouncy})`; op = clamp(lf / 6); }
        else if (k === 'up') { tr = `translateY(${(1 - smooth) * 70}px)`; op = smooth; }
        else if (k === 'left') { tr = `translateX(${(1 - smooth) * -140}px)`; op = smooth; }
        else if (k === 'right') { tr = `translateX(${(1 - smooth) * 140}px)`; op = smooth; }
        else if (k === 'fade') { op = smooth; }
        else if (k === 'drop') { tr = `translateY(${(1 - bouncy) * -180}px) rotate(${(1 - bouncy) * -9}deg)`; op = clamp(lf / 6); }
        else if (k === 'stamp') { tr = `scale(${2.3 - 1.3 * bouncy}) rotate(${s.rot || -8}deg)`; op = clamp(lf / 4); }
        else if (k === 'type') { const n = Math.floor(s.text.length * clamp((T - s.t) / (s.d || 1)));
          html = s.html.replace('%T%', s.text.slice(0, n) + (n < s.text.length ? '<span style="color:#D97757">|</span>' : '')); }
        if (s.float) tr += ` translateY(${Math.sin((T - s.t) * 1.6 + (s.ph || 0)) * s.float}px)`;
        if (s.spin) tr += ` rotate(${(T - s.t) * s.spin}deg)`;
        const ms = spring({frame: Math.round((T - (s.mt || s.t + 0.35)) * FPS), fps: FPS, config: {damping: 200}, durationInFrames: 14});
        const on = s.hl && T >= s.hl[0] && (s.hl[1] === undefined || T < s.hl[1]);
        const style = {}; (s.style || '').split(';').filter(Boolean).forEach(kv => { const [a, ...b] = kv.split(':'); style[a.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = b.join(':').trim(); });
        return <div key={i} className={`e ${s.cls || ''} ${on ? 'on' : ''}`} style={{...style, transform: `${s.base || ''} ${tr}`, opacity: op * (1 - out), '--s': T < (s.mt || s.t + 0.35) ? 0 : ms}}
          dangerouslySetInnerHTML={{__html: html}}/>;
      })}
      {wp < 1 && sc.wipe !== false ? <AbsoluteFill style={{background:'#D97757', transform:`translateX(${wipe}%)`}}/> : null}
    </AbsoluteFill>);
};

const Captions = () => {
  const f = useCurrentFrame(); const T = f / FPS;
  if (T > CAP_END) return null;
  const p = CAPS.find(ph => T >= ph[0].s - 0.08 && T <= ph[ph.length - 1].e + 0.25);
  if (!p) return null;
  const pf = Math.round((T - (p[0].s - 0.08)) * FPS);
  const enter = spring({frame: pf, fps: FPS, config: {damping: 200}, durationInFrames: 6});
  return (
    <div style={{position:'absolute',left:0,right:0,top:985,display:'flex',justifyContent:'center'}}>
      <div style={{background:'rgba(26,25,21,.88)',borderRadius:18,padding:'10px 26px',display:'flex',gap:14,
        transform:`translateY(${(1-enter)*14}px)`,opacity:enter,font:"800 44px 'Inter'",letterSpacing:'-.01em'}}>
        {p.map((w, i) => { const on = T >= w.s && T < (p[i + 1] ? p[i + 1].s : w.e + 0.25);
          const said = T >= w.s;
          return <span key={i} style={{color: on ? '#F2A07F' : said ? '#fff' : 'rgba(255,255,255,.55)', display:'inline-block', transform:`scale(${on ? 1.08 : 1})`}}>{w.w}</span>; })}
      </div>
    </div>);
};

const Main = () => (
  <AbsoluteFill style={{background:'#F4F1EA'}}>
    <style>{CSS}</style>
    {SEGS.map((g) => {
      const from = Math.round(g.start * FPS), dur = Math.round(g.end * FPS) - from;
      return <Sequence key={g.id} from={from} durationInFrames={dur}>
        {g.type === 'motion' ? <Scene sc={g}/> : <OffthreadVideo src={staticFile(`seg/${g.id}.mp4`)} muted/>}
      </Sequence>;
    })}
    <Captions/>
  </AbsoluteFill>);

registerRoot(() => <>
  <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080}/>
</>);
