const { useState, useEffect, useRef } = React;

/* ══════════════════════════════════════════════════════
   TOKENS
══════════════════════════════════════════════════════ */
const C = {
  ink: "#E8E4DC", inkMid: "#A0A890", inkSoft: "#5A6456",
  accent: "#4CAF50", accentBright: "#66BB6A", accentLight: "rgba(76,175,80,0.12)",
  bloom: "#FFB300", bloomLight: "rgba(255,179,0,0.12)",
  seed: "#8D6E63", seedGlow: "#66BB6A",
  surface: "rgba(15,22,15,0.88)", glass: "rgba(12,18,12,0.75)",
  border: "rgba(76,175,80,0.18)",
  bg: "#070D07", bgMid: "#0D160D", bgSurface: "#111A11",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Inter:wght@300;400;450;500;600&display=swap');`;

/* ══════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════ */
const CSS = `
${FONTS}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{min-height:100%;background:#070D07;}
html{overflow-y:auto!important;}
body{overflow-y:auto;overflow-x:hidden;}
body{font-family:'Inter',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;}
.app{min-height:100vh;display:flex;flex-direction:column;background:#070D07;position:relative;}
.garden-bg{position:fixed;inset:-6%;z-index:0;background:url('assets/garden-scene.png') center/cover no-repeat;transition:transform 0.9s cubic-bezier(0.22,1,0.36,1);filter:brightness(0.55) saturate(0.8);}
.garden-overlay{position:fixed;inset:0;z-index:1;background:linear-gradient(to bottom,rgba(4,10,4,0.55) 0%,rgba(4,10,4,0.25) 40%,rgba(4,10,4,0.70) 100%);pointer-events:none;}
.firefly{position:absolute;border-radius:50%;pointer-events:none;animation:fireflyFloat 5s ease-in-out infinite;opacity:0;}
@keyframes fireflyFloat{0%,100%{opacity:0;transform:translate(0,0);}20%{opacity:0.9;}50%{opacity:0.65;transform:translate(10px,-16px);}80%{opacity:0.4;transform:translate(-5px,-8px);}}

/* SCENE */
.scene-header{position:relative;width:100%;overflow:hidden;flex-shrink:0;}
.scene-nav{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;}
.nav-logo{font-family:'Fraunces',Georgia,serif;font-size:15px;font-weight:400;color:${C.ink};background:rgba(7,13,7,0.82);backdrop-filter:blur(12px);padding:6px 13px;border-radius:100px;border:1px solid rgba(76,175,80,0.2);}
.nav-back{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:${C.ink};background:rgba(7,13,7,0.82);backdrop-filter:blur(12px);border:1px solid rgba(76,175,80,0.2);cursor:pointer;padding:6px 13px;border-radius:100px;font-family:'Inter',sans-serif;font-weight:450;transition:all 0.15s;}
.nav-back:hover{background:rgba(20,32,20,0.95);border-color:rgba(76,175,80,0.4);}

/* PANEL */
.content-panel{flex:1;background:rgba(7,14,7,0.72);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border-radius:22px 22px 0 0;margin-top:-24px;position:relative;z-index:5;padding:24px 18px 120px;max-width:680px;width:100%;margin-left:auto;margin-right:auto;border:1px solid rgba(76,175,80,0.18);border-bottom:none;}

/* ENTER */
.page-enter{animation:pgIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;}
@keyframes pgIn{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}

/* TYPE */
.serif-xl{font-family:'Fraunces',Georgia,serif;font-size:clamp(24px,5vw,34px);font-weight:300;line-height:1.22;color:${C.ink};}
.serif-lg{font-family:'Fraunces',Georgia,serif;font-size:clamp(20px,4vw,27px);font-weight:300;line-height:1.28;color:${C.ink};}
.serif-md{font-family:'Fraunces',Georgia,serif;font-size:18px;font-weight:400;line-height:1.4;color:${C.ink};}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${C.accent};}
.body{font-size:15px;line-height:1.65;color:${C.inkMid};}
.body-sm{font-size:13.5px;line-height:1.6;color:${C.inkMid};}
.caption{font-size:12px;color:${C.inkSoft};}

/* CARDS */
.g-card{background:rgba(15,22,15,0.85);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-radius:16px;padding:18px;border:1px solid rgba(76,175,80,0.14);box-shadow:0 2px 16px rgba(0,0,0,0.3);}
.g-card-accent{border-left:3px solid ${C.accentBright};}
.g-card-bloom{border-left:3px solid ${C.bloom};background:rgba(20,14,4,0.9);}

/* LEAF CARDS */
.leaf-card{background:rgba(15,22,15,0.82);border-radius:18px;padding:20px 16px;display:flex;flex-direction:column;gap:9px;cursor:pointer;border:2px solid rgba(76,175,80,0.12);box-shadow:0 2px 12px rgba(0,0,0,0.3);transition:all 0.2s cubic-bezier(0.22,1,0.36,1);}
.leaf-card:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(76,175,80,0.15);border-color:rgba(76,175,80,0.4);}

/* BTNS */
.btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:100px;cursor:pointer;font-family:'Inter',sans-serif;font-weight:500;font-size:14px;transition:all 0.18s cubic-bezier(0.22,1,0.36,1);}
.btn:active{transform:scale(0.97);}
.btn:focus-visible{outline:2.5px solid ${C.accentBright};outline-offset:3px;}
.btn-grow{background:${C.accent};color:#fff;padding:13px 26px;box-shadow:0 3px 12px rgba(46,125,50,0.32);}
.btn-grow:hover{transform:translateY(-2px);background:#1B5E20;box-shadow:0 6px 20px rgba(46,125,50,0.38);}
.btn-bloom{background:linear-gradient(135deg,${C.bloom},#E65100);color:#fff;padding:13px 26px;box-shadow:0 3px 12px rgba(255,143,0,0.38);}
.btn-bloom:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(255,143,0,0.44);}
.btn-outline{background:rgba(15,22,15,0.75);color:${C.ink};padding:11px 20px;border:1.5px solid rgba(76,175,80,0.22);backdrop-filter:blur(6px);}
.btn-outline:hover{background:rgba(25,38,25,0.95);border-color:rgba(76,175,80,0.45);}
.btn-ghost{background:transparent;color:${C.inkMid};padding:8px 14px;font-size:13px;}
.btn-ghost:hover{color:${C.ink};background:rgba(255,255,255,0.05);}
.btn-sm{font-size:12.5px;padding:7px 13px;}

/* INPUT */
.input{width:100%;background:rgba(15,22,15,0.85);border:1.5px solid rgba(76,175,80,0.2);border-radius:12px;padding:13px 16px;font-family:'Inter',sans-serif;font-size:15px;color:${C.ink};outline:none;transition:border-color 0.18s,box-shadow 0.18s;}
.input::placeholder{color:${C.inkSoft};}
.input:focus{border-color:${C.accentBright};box-shadow:0 0 0 3px rgba(76,175,80,0.12);}
.textarea{resize:none;min-height:80px;line-height:1.6;}

/* PILLS */
.pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:100px;font-size:11.5px;font-weight:500;}
.pill-green{background:rgba(76,175,80,0.15);color:#66BB6A;}
.pill-amber{background:rgba(255,179,0,0.15);color:#FFB300;}
.pill-grey{background:rgba(255,255,255,0.08);color:#8A9A8A;}

/* ACK CHIPS */
.ack-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;border-radius:100px;font-size:12.5px;background:rgba(255,255,255,0.05);border:1.5px solid rgba(76,175,80,0.15);cursor:pointer;transition:all 0.15s;font-family:'Inter',sans-serif;color:${C.inkMid};}
.ack-chip:hover,.ack-chip.on{border-color:${C.accentBright};background:${C.accentLight};color:${C.accentBright};font-weight:500;}
.ack-chip.on-bloom{border-color:${C.bloom};background:${C.bloomLight};color:${C.bloom};font-weight:500;}

/* MEMBER / TREE ROW */
.m-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);}
.m-row:last-child{border-bottom:none;}

/* ── ROLE BADGE ANIMATIONS ── */
@keyframes readerPulse{0%{box-shadow:0 0 0 0 rgba(138,158,138,0.5);}70%{box-shadow:0 0 0 12px rgba(138,158,138,0);}100%{box-shadow:0 0 0 0 rgba(138,158,138,0);}}
@keyframes participantBurst{0%{transform:scale(0.8);opacity:0;}40%{transform:scale(1.06);}70%{transform:scale(0.97);}100%{transform:scale(1);opacity:1;}}
@keyframes participantGlow{0%,100%{box-shadow:0 0 0 0 rgba(67,160,71,0);}50%{box-shadow:0 0 0 8px rgba(67,160,71,0.2);}}
@keyframes bloomUnfurl{0%{transform:scale(0.3) rotate(-20deg);opacity:0;}50%{transform:scale(1.08) rotate(3deg);opacity:1;}100%{transform:scale(1) rotate(0deg);opacity:1;}}
@keyframes bloomRipple{0%{transform:scale(0.6);opacity:0.7;}100%{transform:scale(2.2);opacity:0;}}
@keyframes bloomBg{0%{background:#F1F8E9;}100%{background:#FFF8E1;}}
@keyframes leafFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
@keyframes leafBurst{0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:1;}60%{transform:translate(-50%,-150%) scale(1.2) rotate(20deg);opacity:0.8;}100%{transform:translate(-50%,-260%) scale(0.6) rotate(40deg);opacity:0;}}@keyframes leafBurst2{0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:1;}60%{transform:translate(-150%,-130%) scale(1.1) rotate(-15deg);opacity:0.8;}100%{transform:translate(-260%,-200%) scale(0.5) rotate(-35deg);opacity:0;}}@keyframes leafBurst3{0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:1;}60%{transform:translate(60%,-160%) scale(1.3) rotate(25deg);opacity:0.8;}100%{transform:translate(180%,-240%) scale(0.5) rotate(55deg);opacity:0;}}@keyframes endorseGlow{0%{box-shadow:0 0 0 0 rgba(255,213,79,0);}50%{box-shadow:0 0 0 12px rgba(255,213,79,0.35);}100%{box-shadow:0 0 0 20px rgba(255,213,79,0);}}
@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
@keyframes sproutUp{0%{transform:scaleY(0);transform-origin:bottom;}100%{transform:scaleY(1);transform-origin:bottom;}}
@keyframes fadeSlideUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes pgIn{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}

.role-badge{display:flex;align-items:center;gap:11px;padding:13px 16px;border-radius:13px;transition:all 0.5s ease;}
.role-reader{background:rgba(255,255,255,0.05);animation:readerPulse 2s ease-out;}
.role-participant{background:linear-gradient(135deg,rgba(76,175,80,0.15),rgba(76,175,80,0.08));border:1.5px solid rgba(76,175,80,0.3);animation:participantBurst 0.6s cubic-bezier(0.22,1,0.36,1),participantGlow 2s ease-in-out 0.6s infinite;}
.role-steward{background:linear-gradient(135deg,rgba(255,179,0,0.15),rgba(255,179,0,0.08));border:1.5px solid rgba(255,179,0,0.3);animation:participantBurst 0.6s cubic-bezier(0.22,1,0.36,1);}

/* BLOOM CELEBRATION */
.bloom-bg{animation:bloomBgDark 1.2s ease forwards;}@keyframes bloomBgDark{0%{background:#0D160D;}100%{background:rgba(20,12,0,0.95);}}
.bloom-icon{animation:bloomUnfurl 1.2s cubic-bezier(0.22,1,0.36,1) forwards;}
.bloom-ripple{position:absolute;width:80px;height:80px;border-radius:50%;border:2px solid rgba(255,143,0,0.5);animation:bloomRipple 1.4s ease-out forwards;}
.bloom-ripple-2{animation-delay:0.3s;border-color:rgba(255,143,0,0.3);}
.bloom-ripple-3{animation-delay:0.6s;border-color:rgba(255,143,0,0.15);}

/* STATUS OPTS */
.s-opt{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:11px;border:1.5px solid rgba(76,175,80,0.18);background:rgba(15,22,15,0.8);cursor:pointer;font-size:13.5px;color:${C.inkMid};transition:all 0.15s;font-family:'Inter',sans-serif;}
.s-opt:hover,.s-opt.on{border-color:${C.accentBright};background:${C.accentLight};color:${C.accentBright};font-weight:500;}
.s-opt.on-bloom{border-color:${C.bloom};background:${C.bloomLight};color:${C.bloom};font-weight:500;}

/* SEED STATUS INLINE BAR */
.status-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:100px;background:rgba(15,22,15,0.8);border:1px solid rgba(76,175,80,0.2);cursor:pointer;transition:all 0.15s;}
.status-bar:hover{background:rgba(25,38,25,0.95);border-color:rgba(76,175,80,0.4);}

/* TREE CONTRIBUTOR */
.tree-person{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:11px;border:1.5px solid rgba(76,175,80,0.16);background:rgba(15,22,15,0.82);cursor:pointer;transition:all 0.2s;margin-bottom:7px;animation:leafFloat 3s ease-in-out infinite;}
.tree-person:nth-child(2){animation-delay:0.4s;}
.tree-person:nth-child(3){animation-delay:0.8s;}
.tree-person.endorsed{border-color:#FFD54F;background:rgba(20,14,4,0.9);box-shadow:0 0 0 3px rgba(255,213,79,0.15);}
.tree-person.me-too{border-color:${C.accentBright};background:${C.accentLight};box-shadow:0 0 0 3px rgba(67,160,71,0.12);}
.endorse-count{font-size:11.5px;font-weight:600;color:#FFB300;margin-left:auto;background:rgba(255,179,0,0.12);padding:2px 8px;border-radius:100px;}

/* MODAL OVERLAY */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;}
.modal-sheet{background:#0D160D;border:1px solid rgba(76,175,80,0.2);border-radius:22px 22px 0 0;padding:24px 20px 40px;width:100%;max-width:680px;animation:slideUp 0.3s cubic-bezier(0.22,1,0.36,1);}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
.modal-handle{width:40px;height:4px;background:rgba(255,255,255,0.12);border-radius:2px;margin:0 auto 18px;}

/* DIVIDER */
.div-row{display:flex;align-items:center;gap:12px;margin:16px 0;}
.div-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(76,175,80,0.25),transparent);}

@media(prefers-reduced-motion:reduce){*{animation-duration:0.001ms!important;transition-duration:0.001ms!important;}}
`;

/* ══════════════════════════════════════════════════════
   SVG SCENE
══════════════════════════════════════════════════════ */
function Particles({ count = 10, color = "#A5D6A7" }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = 5 + (i * 137.5 % 90);
        const delay = i * 0.4, dur = 4 + (i % 4), size = 2 + (i % 3);
        return (
          <circle key={i} cx={`${x}%`} cy="75%" r={size} fill={color} opacity="0.5">
            <animate attributeName="cy" values="82%;15%;82%" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.65;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            <animate attributeName="cx" values={`${x}%;${x+3}%;${x}%`} dur={`${dur*1.3}s`} begin={`${delay}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

function Tree({ x, y, scale = 1 }) {
  const s = scale, r = 22 * s;
  return (
    <g transform={`translate(${x},${y - r * 1.5 - 28 * s})`}>
      <rect x={-4*s} y={r*1.4} width={8*s} height={28*s} fill="#795548" rx={2} />
      <circle cx={0} cy={r*0.5} r={r} fill="#2E7D32" />
      <circle cx={-r*0.5} cy={r*0.85} r={r*0.72} fill="#388E3C" opacity="0.85" />
      <circle cx={r*0.5} cy={r*0.85} r={r*0.72} fill="#388E3C" opacity="0.85" />
      <circle cx={0} cy={r*0.15} r={r*0.58} fill="#43A047" opacity="0.7" />
    </g>
  );
}

function SacredTreeSvg({ cx, cy, scale = 1 }) {
  const s = scale;
  return (
    <g transform={`translate(${cx},${cy})`}>
      <rect x={-10*s} y={0} width={20*s} height={80*s} fill="#5D4037" rx={5*s} />
      <path d={`M-10,${80*s} Q-28,${98*s} -45,${88*s}`} stroke="#5D4037" strokeWidth={5*s} fill="none" strokeLinecap="round"/>
      <path d={`M10,${80*s} Q28,${98*s} 45,${88*s}`} stroke="#5D4037" strokeWidth={5*s} fill="none" strokeLinecap="round"/>
      <path d={`M0,${12*s} Q-48,${-18*s} -78,${-8*s}`} stroke="#6D4C41" strokeWidth={7*s} fill="none" strokeLinecap="round"/>
      <path d={`M0,${12*s} Q48,${-18*s} 78,${-8*s}`} stroke="#6D4C41" strokeWidth={7*s} fill="none" strokeLinecap="round"/>
      <path d={`M0,${30*s} Q-38,${-2*s} -56,${-26*s}`} stroke="#6D4C41" strokeWidth={5*s} fill="none" strokeLinecap="round"/>
      <path d={`M0,${30*s} Q38,${-2*s} 56,${-26*s}`} stroke="#6D4C41" strokeWidth={5*s} fill="none" strokeLinecap="round"/>
      <path d={`M0,${6*s} Q0,${-36*s} 0,${-55*s}`} stroke="#6D4C41" strokeWidth={6*s} fill="none" strokeLinecap="round"/>
      {[-78,-52,0,52,78].map((bx,i)=>(
        <g key={i}>
          <circle cx={bx*s} cy={(-14+(i%2===0?-9:4))*s} r={(22+i*1.5)*s} fill="#1B5E20" opacity="0.82"/>
          <circle cx={bx*s} cy={(-20+(i%2===0?-9:4))*s} r={(16+i)*s} fill="#2E7D32" opacity="0.7"/>
        </g>
      ))}
      {[-68,-44,8,46,70,-18,22].map((lx,i)=>(
        <circle key={i} cx={lx*s} cy={(-18+(i*7%28-14))*s} r={4*s} fill="#FFD54F" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.35;0.9" dur={`${2+i*0.28}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </g>
  );
}

function LotusFlower({ cx, cy, scale = 1 }) {
  const s = scale;
  return (
    <g transform={`translate(${cx},${cy})`}>
      <ellipse cx={0} cy={8*s} rx={42*s} ry={9*s} fill="#80DEEA" opacity="0.4"/>
      {[0,51,102,153,204,255,306].map((deg,i)=>(
        <ellipse key={i} cx={0} cy={-17*s} rx={9*s} ry={21*s}
          fill={i%2===0?"#FFB74D":"#FF8F00"} opacity="0.85"
          transform={`rotate(${deg})`} style={{transformOrigin:"0px 0px"}}>
          <animateTransform attributeName="transform" type="rotate"
            values={`${deg};${deg+2};${deg}`} dur={`${3+i*0.2}s`} repeatCount="indefinite" additive="sum"/>
        </ellipse>
      ))}
      {[0,72,144,216,288].map((deg,i)=>(
        <ellipse key={i} cx={0} cy={-11*s} rx={6*s} ry={15*s}
          fill="#FFCC02" opacity="0.9" transform={`rotate(${deg})`} style={{transformOrigin:"0px 0px"}}/>
      ))}
      <circle cx={0} cy={-4*s} r={7*s} fill="#FF6F00"/>
      <circle cx={0} cy={-5*s} r={4*s} fill="#FFD54F"/>
    </g>
  );
}

function GardenScene({ height = 200, stage = "growing" }) {
  const skyTop = stage==="bloom"?"#FFF9C4":stage==="tree"?"#BBDEFB":"#D0F0D0";
  const skyBot = stage==="bloom"?"#FFE082":stage==="tree"?"#90CAF9":"#A5D6A7";
  return (
    <svg viewBox={`0 0 900 ${height}`} preserveAspectRatio="xMidYMid slice" style={{width:"100%",height:"100%",display:"block"}}>
      <defs>
        <linearGradient id={`sg_${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop}/><stop offset="100%" stopColor={skyBot}/>
        </linearGradient>
        <radialGradient id={`sun_${stage}`} cx="75%" cy="25%" r="30%">
          <stop offset="0%" stopColor={stage==="bloom"?"#FFD54F":"#FFFDE7"} stopOpacity="0.9"/>
          <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
        </radialGradient>
        <filter id="blr"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <rect width="900" height={height} fill={`url(#sg_${stage})`} opacity="0.45"/>
      <rect width="900" height={height} fill={`url(#sun_${stage})`} opacity="0.5"/>
      <ellipse cx="120" cy="42" rx="68" ry="20" fill="white" opacity="0.52" filter="url(#blr)"/>
      <ellipse cx="155" cy="36" rx="48" ry="16" fill="white" opacity="0.42" filter="url(#blr)"/>
      <ellipse cx="640" cy="50" rx="76" ry="18" fill="white" opacity="0.38" filter="url(#blr)"/>
      <ellipse cx="450" cy={height+12} rx="510" ry={height*0.52} fill={stage==="bloom"?"#558B2F":"#388E3C"} opacity="0.58"/>
      <ellipse cx="190" cy={height+22} rx="310" ry={height*0.48} fill={stage==="bloom"?"#689F38":"#43A047"} opacity="0.78"/>
      <ellipse cx="740" cy={height+22} rx="290" ry={height*0.44} fill={stage==="bloom"?"#689F38":"#43A047"} opacity="0.78"/>
      <rect y={height*0.72} width="900" height={height*0.35} fill="#4CAF50"/>
      <rect y={height*0.83} width="900" height={height*0.24} fill="#388E3C"/>
      <rect y={height*0.91} width="900" height={height*0.12} fill="#2E7D32"/>
      <Tree x={78} y={height*0.73} scale={0.68}/>
      <Tree x={142} y={height*0.75} scale={0.48}/>
      <Tree x={775} y={height*0.73} scale={0.72}/>
      <Tree x={838} y={height*0.77} scale={0.44}/>
      {stage==="bloom" && <LotusFlower cx={450} cy={height*0.79} scale={1.05}/>}
      {stage==="tree" && <SacredTreeSvg cx={450} cy={height*0.52} scale={1.15}/>}
      {stage==="growing" && (
        <g transform={`translate(430,${height*0.79})`}>
          <ellipse cx={0} cy={4} rx={38} ry={7} fill="#6D4C41" opacity="0.65"/>
          <line x1={0} y1={5} x2={0} y2={-28} stroke="#558B2F" strokeWidth={3} strokeLinecap="round"/>
          <ellipse cx={-9} cy={-18} rx={11} ry={6} fill="#66BB6A" transform="rotate(-28,-9,-18)"/>
          <ellipse cx={9} cy={-13} rx={10} ry={5.5} fill="#81C784" transform="rotate(24,9,-13)"/>
        </g>
      )}
      {stage==="empty" && (
        <g transform={`translate(450,${height*0.82})`}>
          <ellipse cx={0} cy={0} rx={32} ry={8} fill="#6D4C41" opacity="0.7"/>
          <ellipse cx={0} cy={-5} rx={8} ry={12} fill="#4E342E" opacity="0.85">
            <animate attributeName="opacity" values="0.85;0.4;0.85" dur="2.5s" repeatCount="indefinite"/>
          </ellipse>
          <circle cx={0} cy={-14} r={6} fill="#A5D6A7" opacity="0">
            <animate attributeName="r" values="5;10;5" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </g>
      )}
      {[60,180,290,380,500,600,700,815].map((x,i)=>(
        <g key={i} transform={`translate(${x},${height*0.89})`}>
          <path d="M0,0 C-4,-13 -2,-19 0,-15 C2,-19 4,-13 0,0" fill="#66BB6A" opacity="0.9"/>
          <path d="M5,0 C2,-9 3,-15 5,-12 C7,-15 8,-9 5,0" fill="#81C784" opacity="0.78"/>
        </g>
      ))}
      <Particles count={9} color={stage==="bloom"?"#FFD54F":"#A5D6A7"}/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   SHARED
══════════════════════════════════════════════════════ */
const avCols = ["#388E3C","#1976D2","#E65100","#7B1FA2","#C62828","#00695C","#F57F17"];
function Av({ name, size = 32 }) {
  const col = avCols[name.charCodeAt(0) % avCols.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.38,fontWeight:500,flexShrink:0}}>
      {name[0]}
    </div>
  );
}

function Fireflies() {
  return (
    <div style={{position:"fixed",inset:0,zIndex:2,pointerEvents:"none",overflow:"hidden"}}>
      {Array.from({length:22},(_,i)=>{
        const x=(i*13.7+7)%100, y=(i*19.3+11)%85;
        const delay=(i*0.38)%6, dur=4+(i%4);
        const gold=i%3===0;
        return <div key={i} className="firefly" style={{
          left:`${x}%`,top:`${y}%`,
          width:2+(i%3),height:2+(i%3),
          background:gold?"#FFD54F":"#A5D6A7",
          boxShadow:gold?"0 0 8px 4px rgba(255,213,79,0.75)":"0 0 6px 3px rgba(165,214,167,0.65)",
          animationDelay:`${delay}s`,animationDuration:`${dur}s`,
        }}/>;
      })}
    </div>
  );
}

function ScenePage({ stage="growing", sceneH=195, children, onBack, step, total }) {
  const bgRef = useRef(null);
  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    let tgt = {x:0, y:0}, cur = {x:0, y:0};
    const onMove = (e) => {
      tgt.x = ((e.clientX / window.innerWidth) - 0.5) * 3.5;
      tgt.y = ((e.clientY / window.innerHeight) - 0.5) * 2;
    };
    let raf;
    const tick = () => {
      cur.x += (tgt.x - cur.x) * 0.04;
      cur.y += (tgt.y - cur.y) * 0.04;
      el.style.transform = `translate(${cur.x.toFixed(3)}px,${cur.y.toFixed(3)}px) scale(1.04)`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="app">
      <div className="garden-bg" ref={bgRef}/>
      <div className="garden-overlay"/>
      <Fireflies/>
      <div className="scene-header" style={{height:sceneH,position:"relative",zIndex:3}}>
        <GardenScene height={sceneH} stage={stage}/>
        <div className="scene-nav">
          {onBack ? (
            <button className="nav-back" onClick={onBack}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>
          ) : <span/>}
          <span className="nav-logo">🌱 Rhyza</span>
          {step ? (
            <div style={{display:"flex",gap:4,background:"rgba(7,13,7,0.75)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:100,padding:"5px 9px"}}>
              {Array.from({length:total}).map((_,i)=>(
                <div key={i} style={{width:i===step-1?15:5,height:5,borderRadius:3,background:i<step?C.accentBright:"rgba(0,0,0,0.12)",transition:"all 0.3s"}}/>
              ))}
            </div>
          ) : <span/>}
        </div>
      </div>
      <div className="content-panel" style={{position:"relative",zIndex:3}}>{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROLE BADGE with animation
══════════════════════════════════════════════════════ */
function RoleBadge({ role }) {
  const cfg = {
    reader:      { icon:"👀", label:"You're a Reader.",       sub:"Readers observe. Readers learn.",    cls:"role-reader"      },
    participant: { icon:"🌱", label:"You're a Participant.",  sub:"Participants help ideas grow.",      cls:"role-participant"  },
    steward:     { icon:"🌿", label:"You're a Steward.",      sub:"Stewards help Seeds bloom.",         cls:"role-steward"      },
  };
  const c = cfg[role];
  return (
    <div className={`role-badge ${c.cls}`} style={{marginBottom:18}}>
      <span style={{fontSize:22,flexShrink:0}}>{c.icon}</span>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:role==="reader"?C.inkMid:role==="participant"?C.accent:C.bloom}}>{c.label}</p>
        <p className="caption">{c.sub}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEED STATUS MODAL (bottom sheet)
══════════════════════════════════════════════════════ */
function SeedStatusModal({ onClose, onVote, currentVote }) {
  const opts = [
    { e:"🧠", l:"Needs first principles", v:18 },
    { e:"🔨", l:"Needs practical validation", v:12 },
    { e:"📚", l:"Needs references", v:7 },
    { e:"⚖️", l:"Needs another perspective", v:6 },
    { e:"🌸", l:"Feels ready to Bloom", v:11 },
  ];
  const total = opts.reduce((s,o)=>s+o.v,0);
  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-sheet">
        <div className="modal-handle"/>
        <p className="eyebrow" style={{marginBottom:8}}>Seed Status</p>
        <p className="serif-md" style={{marginBottom:6}}>What does this discussion need next?</p>
        <p className="body-sm" style={{marginBottom:18,color:C.inkSoft}}>Not a vote — guidance for the next visitor.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {opts.map(o=>(
            <button key={o.l}
              className={`s-opt ${currentVote===o.l?(o.l.includes("Bloom")?"on-bloom":"on"):""}`}
              onClick={()=>{ onVote(o.l); setTimeout(onClose, 80); }}>
              <span style={{fontSize:17}}>{o.e}</span>
              <span style={{flex:1,textAlign:"left"}}>{o.l}</span>
              <span style={{fontSize:11.5,opacity:0.55}}>{o.v}{currentVote===o.l?" +1":""}</span>
              <div style={{width:44,height:4,borderRadius:2,background:"rgba(0,0,0,0.07)",overflow:"hidden"}}>
                <div style={{width:`${(o.v/total)*100}%`,height:"100%",background:o.l.includes("Bloom")?C.bloom:C.accentBright,borderRadius:2,transition:"width 0.3s ease"}}/>
              </div>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" style={{width:"100%",justifyContent:"center"}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ACK REACTION STRIP
══════════════════════════════════════════════════════ */
const ACK_OPTS = [
  "💥 It clicked","🎯 Right on point","🧠 Made me think",
  "🌊 Unblocked me","✨ Beautifully explained","🤔 Still confused","🔍 Needs depth"
];

// Extract just the emoji from a reaction label
function ackEmoji(label) { return label.split(" ")[0]; }
function ackText(label) { return label.split(" ").slice(1).join(" "); }

const CONTRIBUTION_TYPES = [
  { id: 'principles', emoji: '🌱', label: 'First principles', color: '#66BB6A', placeholder: 'Explain the core idea from scratch…' },
  { id: 'model',      emoji: '☀️', label: 'Mental model',     color: '#FFD54F', placeholder: 'An analogy or framing that makes it click…' },
  { id: 'impl',       emoji: '🌍', label: 'Implementation',   color: '#4FC3F7', placeholder: 'What you built, broke, or observed in practice…' },
  { id: 'counter',    emoji: '🌬️', label: 'Counter-view',    color: '#CE93D8', placeholder: 'Push back — resistance makes roots stronger…' },
  { id: 'question',   emoji: '✨', label: 'Question',          color: '#FFAB91', placeholder: 'What are you still reaching toward?' },
];

const SEED_DATA = {
  question: "I understand Pods but don't understand why Kubernetes needs them. Why not just run containers directly?",
  stage: 'sprouting',
  aiSummary: "Two themes emerging: Pods enable co-located containers to share networking (the sidecar pattern), and they represent a scheduling unit—not just a container wrapper. Disagreement on whether this abstraction is necessary for small deployments.",
  replies: [
    { author: 'Rahul',  time: '2h ago',  type: 'principles', text: 'Pods exist because Kubernetes needed a way to co-locate containers that share a network namespace. Two containers in the same Pod can communicate via localhost—something impossible across separate containers.', acks: { '💥 It clicked': 12, '🧠 Made me think': 8 } },
    { author: 'Priya',  time: '1h ago',  type: 'impl',       text: 'In production we run a logging sidecar in every Pod—main app on port 3000, log forwarder on localhost:5001. Without Pods, you\'d need a full service mesh just for this.', acks: { '🌊 Unblocked me': 7, '🎯 Right on point': 5 } },
    { author: 'Vivek',  time: '45m ago', type: 'model',      text: 'Think of a Pod like a server. Containers are processes on that server. The server has one IP, all processes share it. Kubernetes schedules servers (Pods), not individual processes (containers).', acks: { '✨ Beautifully explained': 18, '💥 It clicked': 14 } },
    { author: 'Meera',  time: '30m ago', type: 'counter',    text: 'For small single-container deployments this abstraction genuinely adds complexity with no benefit. It only pays off at scale or with sidecar patterns.', acks: { '🤔 Still confused': 3, '🔍 Needs depth': 4 } },
    { author: 'Akash',  time: '15m ago', type: 'question',   text: 'If Pods are the unit of scheduling, what happens when one container in a multi-container Pod crashes? Does the whole Pod restart?', acks: { '🧠 Made me think': 9 } },
  ],
};

function AckStrip({ existing={}, myAcks={}, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const myNew = Object.entries(myAcks).filter(([k,v])=>v&&!existing[k]);
  const available = ACK_OPTS.filter(a=>!existing[a]&&!myAcks[a]);
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:10}}>
      {Object.entries(existing).map(([k,v])=>(
        <button key={k} className={`ack-chip ${myAcks[k]?"on":""}`}
          onClick={()=>onToggle(k)} title={ackText(k)}
          style={{padding:"3px 8px",gap:3,fontSize:13}}>
          <span>{ackEmoji(k)}</span>
          <span style={{fontWeight:600,fontSize:12}}>{v+(myAcks[k]?1:0)}</span>
        </button>
      ))}
      {myNew.map(([k])=>(
        <button key={k} className="ack-chip on" onClick={()=>onToggle(k)} title={ackText(k)}
          style={{padding:"3px 8px",gap:3,fontSize:13}}>
          <span>{ackEmoji(k)}</span>
          <span style={{fontWeight:600,fontSize:12}}>1</span>
        </button>
      ))}
      {!expanded ? (
        <button className="ack-chip" onClick={()=>setExpanded(true)}
          style={{padding:"3px 8px",fontSize:13,borderStyle:"dashed",color:"#888"}}>
          + React
        </button>
      ) : (
        <>
          {available.map(a=>(
            <button key={a} className="ack-chip" onClick={()=>{onToggle(a);setExpanded(false);}}
              title={ackText(a)} style={{padding:"3px 8px",gap:4,fontSize:13}}>
              <span>{ackEmoji(a)}</span>
              <span style={{fontSize:11,color:"#777"}}>{ackText(a)}</span>
            </button>
          ))}
          <button className="ack-chip" onClick={()=>setExpanded(false)}
            style={{padding:"3px 8px",fontSize:12,color:"#999"}}>✕</button>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   REPLY THREAD
══════════════════════════════════════════════════════ */
function Reply({ r, myAcks, onAck }) {
  const [showAcks, setShowAcks] = useState(false);
  return (
    <div style={{paddingLeft:14,marginTop:10,borderLeft:`2px solid rgba(46,125,50,0.22)`,position:"relative"}}>
      <div style={{display:"flex",gap:8,marginBottom:6}}>
        <Av name={r.author} size={26}/>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:6,alignItems:"baseline"}}>
            <span style={{fontSize:13.5,fontWeight:500,color:C.ink}}>{r.author}</span>
            <span className="caption">{r.time}</span>
          </div>
          <p className="body-sm" style={{marginTop:3}}>{r.text}</p>
        </div>
      </div>
      {/* Reaction bar */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:4}}>
          {Object.entries(r.acks||{}).map(([k,v])=>(
            <button key={k} className={`ack-chip btn-sm ${myAcks[k]?"on":""}`}
              onClick={()=>onAck(k)} title={ackText(k)}
              style={{padding:"3px 7px",gap:3,fontSize:12}}>
              <span>{ackEmoji(k)}</span>
              <span style={{fontWeight:600,fontSize:11}}>{v+(myAcks[k]?1:0)}</span>
            </button>
          ))}
          {!showAcks ? (
            <button className="ack-chip btn-sm" style={{color:C.inkSoft,borderStyle:"dashed",padding:"3px 7px",fontSize:12}} onClick={()=>setShowAcks(true)}>+</button>
          ) : (
            ACK_OPTS.filter(a=>!r.acks?.[a]).map(a=>(
              <button key={a} className={`ack-chip btn-sm ${myAcks[a]?"on":""}`}
                onClick={()=>{onAck(a);setShowAcks(false);}} title={ackText(a)}
                style={{padding:"3px 7px",fontSize:12}}>
                {ackEmoji(a)}
              </button>
            ))
          )}
        </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SEED CONVERSATION CARD
══════════════════════════════════════════════════════ */
function S1_Intent({ go }) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = () => { if(!search.trim())return; setLoading(true); setTimeout(()=>{setLoading(false);go("nogarden");},900); };
  const intents = [
    { e:"🌱", l:"I want to learn.", w:"The Garden" },
    { e:"🚀", l:"I want to achieve.", w:"The Summit" },
    { e:"🤝", l:"I need help.", w:"The War Room" },
    { e:"❤️", l:"I want to help someone.", w:"The Lighthouse" },
    { e:"🌍", l:"I want to meet people.", w:"The Hub" },
    { e:"✨", l:"I want to explore.", w:"The Observatory" },
  ];
  return (
    <ScenePage stage="growing" sceneH={160} step={1} total={8}>
      <p className="eyebrow" style={{marginBottom:8}}>Your intention</p>
      <h1 className="serif-xl" style={{marginBottom:16}}>What brings you here today?</h1>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input className="input" placeholder='Type a topic — try "Kubernetes"…' value={search}
          onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} autoFocus/>
        <button className="btn btn-grow" onClick={submit} style={{whiteSpace:"nowrap"}}>{loading?"…":"Find"}</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:22}}>
        {["Kubernetes","LLMs","System Design","Rust","Leadership"].map(t=>(
          <button key={t} onClick={()=>{setSearch(t);setTimeout(()=>go("nogarden"),100);}} style={{
            background:"rgba(76,175,80,0.08)",border:"1.5px solid rgba(76,175,80,0.2)",borderRadius:100,
            padding:"5px 12px",fontSize:12.5,color:C.accentBright,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>
            🌱 {t}
          </button>
        ))}
      </div>
      <div className="div-row" style={{marginBottom:16}}><div className="div-line"/><span className="caption">or choose your intention</span><div className="div-line"/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:8}}>
        {intents.map((item,i)=>(
          <button key={i} className="leaf-card" onClick={()=>go("search")} style={{textAlign:"left",width:"100%",fontFamily:"'Inter',sans-serif"}}>
            <span style={{fontSize:24}}>{item.e}</span>
            <span style={{fontSize:13.5,fontWeight:500,color:C.ink,lineHeight:1.35}}>{item.l}</span>
            <span style={{fontSize:11,color:C.accentBright,fontWeight:500}}>{item.w}</span>
          </button>
        ))}
      </div>
    </ScenePage>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 2 — SEARCH
══════════════════════════════════════════════════════ */
function S2_Search({ go, back }) {
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = () => { if(!val.trim())return; setLoading(true); setTimeout(()=>{setLoading(false);go("nogarden");},900); };
  return (
    <ScenePage stage="empty" sceneH={170} onBack={back} step={2} total={8}>
      <p className="eyebrow" style={{marginBottom:10}}>Find your garden</p>
      <h1 className="serif-xl" style={{marginBottom:6}}>What do you want to learn?</h1>
      <p className="body" style={{marginBottom:22}}>Search for a garden, or plant a new one.</p>
      <div style={{display:"flex",gap:8,marginBottom:26}}>
        <input className="input" placeholder='Try "Kubernetes", "LLM fine-tuning"…' value={val}
          onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} autoFocus/>
        <button className="btn btn-grow" onClick={submit}>{loading?"…":"Search"}</button>
      </div>
      <p className="caption" style={{marginBottom:11}}>Thriving gardens right now</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {["System Design","LLMs","Data Mesh","Rust","DevEx","Distributed Systems"].map(t=>(
          <button key={t} onClick={()=>go("nogarden")} style={{
            background:"rgba(76,175,80,0.08)",border:"1.5px solid rgba(76,175,80,0.2)",borderRadius:100,
            padding:"6px 13px",fontSize:13,color:C.accentBright,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accentBright;e.currentTarget.style.background="rgba(76,175,80,0.18)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(76,175,80,0.2)";e.currentTarget.style.background="rgba(76,175,80,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(46,125,50,0.16)";e.currentTarget.style.color=C.inkMid;}}>
            🌱 {t}
          </button>
        ))}
      </div>
    </ScenePage>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 3 — NO GARDEN
══════════════════════════════════════════════════════ */
function S3_NoGarden({ go, back }) {
  return (
    <ScenePage stage="empty" sceneH={170} onBack={back} step={3} total={8}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",paddingTop:4}}>
        <svg width="88" height="88" viewBox="0 0 88 88" style={{marginBottom:18}}>
          <ellipse cx="44" cy="70" rx="30" ry="8" fill="#6D4C41" opacity="0.48"/>
          <ellipse cx="44" cy="64" rx="19" ry="5.5" fill="#8D6E63" opacity="0.38"/>
          <ellipse cx="44" cy="57" rx="8.5" ry="12" fill="#4E342E" opacity="0.82">
            <animate attributeName="opacity" values="0.82;0.38;0.82" dur="2.5s" repeatCount="indefinite"/>
          </ellipse>
          <circle cx="44" cy="43" r="6" fill="#A5D6A7" opacity="0">
            <animate attributeName="r" values="5;11;5" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.55;0;0.55" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </svg>
        <p className="eyebrow" style={{marginBottom:8}}>No garden yet</p>
        <h1 className="serif-lg" style={{marginBottom:10}}>No Kubernetes Garden exists yet.</h1>
        <p className="body" style={{maxWidth:360,marginBottom:4}}>Every thriving garden begins with one curious person.</p>
        <p className="serif-md" style={{color:C.accent,fontStyle:"italic",marginBottom:28}}>Today, that's you.</p>
        <button className="btn btn-grow" style={{fontSize:15,padding:"14px 34px"}} onClick={()=>go("garden")}>
          🌱 Plant the Garden
        </button>
        <p className="caption" style={{marginTop:12}}>You'll be the first member. Others will follow.</p>
      </div>
    </ScenePage>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 4b — GARDEN HOME (seed list)
══════════════════════════════════════════════════════ */
const GARDEN_SEEDS = [
  { id:"s1", emoji:"🌱", title:"I want to understand Kubernetes beyond YouTube videos. Where should I begin?", author:"Siva", replies:3, readers:134, age:"3h" },
  { id:"s2", emoji:"🌱", title:"What's the difference between a Deployment and a StatefulSet?", author:"Meera", replies:8, readers:62, age:"1d" },
  { id:"s3", emoji:"🌱", title:"How do I design for pod failure without losing data?", author:"Arun", replies:5, readers:88, age:"2d" },
  { id:"s4", emoji:"🌸", title:"Kubernetes Pods Explained", author:"Priya", replies:47, readers:320, age:"1w", bloomed:true },
];

function S4b_GardenHome({ go, back, goProfile }) {
  return (
    <ScenePage stage="growing" sceneH={180} onBack={back} step={4} total={8}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5}}>
        <span style={{fontSize:26}}>🌱</span>
        <h1 className="serif-lg">Kubernetes Garden</h1>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:22}}>
        <span className="pill pill-green">26 participants</span>
        <span className="pill pill-grey">4 seeds</span>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:22}}>
        {GARDEN_SEEDS.map(s=>(
          <button key={s.id} onClick={()=>go("seed")}
            style={{display:"flex",gap:12,alignItems:"flex-start",padding:"14px 16px",background:"rgba(15,22,15,0.82)",backdropFilter:"blur(12px)",border:`1.5px solid ${s.bloomed?"rgba(255,179,0,0.28)":C.border}`,borderRadius:14,cursor:"pointer",textAlign:"left",transition:"all 0.2s",fontFamily:"'Inter',sans-serif"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(25,40,25,0.95)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 18px rgba(76,175,80,0.14)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(15,22,15,0.82)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            <span style={{fontSize:20,marginTop:2}}>{s.emoji}</span>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:500,color:C.ink,lineHeight:1.45,marginBottom:6}}>{s.title}</p>
              <div style={{display:"flex",gap:10,fontSize:12,color:C.inkSoft}}>
                <span>{s.author}</span>
                <span>·</span>
                <span>{s.replies} replies</span>
                <span>·</span>
                <span>{s.readers} readers</span>
                <span>·</span>
                <span>{s.age}</span>
              </div>
            </div>
            {s.bloomed && <span className="pill pill-amber" style={{marginTop:2,flexShrink:0}}>🌸 Bloom</span>}
          </button>
        ))}
      </div>

      <div style={{marginBottom:16}}>
        <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(76,175,80,0.5)",marginBottom:10}}>MEMBERS · 26</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{n:"Siva",c:"#8B7355"},{n:"Rahul",c:"#2d5a3d"},{n:"Priya",c:"#6B4C8A"},{n:"Vivek",c:"#2a6fdb"},{n:"Meera",c:"#d4a574"},{n:"Akash",c:"#1F8A5B"}].map(m=>(
            <button key={m.n} onClick={()=>goProfile&&goProfile(m.n)} title={m.n}
              style={{width:36,height:36,borderRadius:"50%",background:m.c,border:"2px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";}}
            >{m.n[0]}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <button className="btn btn-grow" style={{flex:1,justifyContent:"center"}} onClick={()=>go("garden")}>
          🌱 Plant a Seed
        </button>
        <button className="btn btn-outline" style={{flex:1,justifyContent:"center"}} onClick={()=>go("tree")}>
          🌳 Sacred Tree
        </button>
      </div>
      <button className="btn btn-ghost" style={{width:"100%",justifyContent:"center",fontSize:13,border:"1px dashed rgba(76,175,80,0.25)",borderRadius:10,padding:"10px"}} onClick={()=>{
        const email=window.prompt("Invite someone to this garden (enter email or name):");
        if(email&&email.trim()) window.alert("Invitation sent to "+email.trim()+" \ud83c\udf31");
      }}>
        + Invite a member to Kubernetes Garden
      </button>
    </ScenePage>
  );
}
function S4_Garden({ go, back }) {
  const [text, setText] = useState("");
  return (
    <ScenePage stage="growing" sceneH={195} onBack={back} step={4} total={8}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:5}}>
        <span style={{fontSize:26}}>🌱</span>
        <h1 className="serif-lg">Kubernetes Garden</h1>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <span className="pill pill-green">Growing since today</span>
        <span className="pill pill-grey">1 member</span>
      </div>
      <div className="g-card" style={{background:"rgba(76,175,80,0.06)",border:"1px solid rgba(76,175,80,0.18)",marginBottom:18}}>
        <p className="body-sm" style={{fontStyle:"italic",color:C.inkMid}}>
          Gardens are where people learn, teach, and grow together.
        </p>
      </div>
      <div className="g-card g-card-accent">
        <p className="eyebrow" style={{marginBottom:10}}>Plant your first seed</p>
        <p className="serif-md" style={{marginBottom:12,color:C.inkMid,fontStyle:"italic"}}>🌱 What brought you here?</p>
        <textarea className="input textarea" style={{minHeight:72}}
          placeholder="I want to understand Kubernetes beyond YouTube videos. Where should I begin?"
          value={text} onChange={e=>setText(e.target.value)} rows={3}/>
        <div style={{marginTop:12}}>
          <button className="btn btn-grow" onClick={()=>go("invite")}>🌱 Plant this Seed</button>
        </div>
      </div>
    </ScenePage>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 5 — INVITE
══════════════════════════════════════════════════════ */
function S5_Invite({ go, back }) {
  const [invited, setInvited] = useState([]);
  const people = ["Boaz","Rahul","Priya","Arun","Ishan","Meera"];
  const tog = p => setInvited(v=>v.includes(p)?v.filter(x=>x!==p):[...v,p]);
  return (
    <ScenePage stage="growing" sceneH={170} onBack={back} step={5} total={8}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:44,marginBottom:10}}>🌱</div>
        <h1 className="serif-lg" style={{marginBottom:7}}>Your first Seed is planted.</h1>
        <p className="body">Every thriving garden begins with a few curious people.</p>
      </div>
      <div className="g-card" style={{marginBottom:14}}>
        <p className="eyebrow" style={{marginBottom:13}}>Invite to this Garden</p>
        {people.map(p=>(
          <div key={p} className="m-row">
            <Av name={p}/>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:500,color:C.ink}}>{p}</p>
              <p className="caption">Engineering · Juspay</p>
            </div>
            <button className="btn btn-ghost" style={{fontSize:13,color:invited.includes(p)?C.accent:C.inkMid,fontWeight:invited.includes(p)?500:400}}
              onClick={()=>tog(p)}>
              {invited.includes(p)?"✓ Invited":"Invite"}
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-grow" onClick={()=>go("gardenHome")} style={{width:"100%",justifyContent:"center"}}>
        {invited.length>0?`Send invitations (${invited.length})`:`Enter the Garden →`}
      </button>
    </ScenePage>
  );
}

/* ══════════════════════════════════════════════════════
   SEED LIFECYCLE — PLANT + STAGES + BLOOM
══════════════════════════════════════════════════════ */

const STAGES = [
  { id:0, name:'Seed',        emoji:'🌱', color:'#8D6E63', glow:'rgba(141,110,99,0.25)',  desc:'A question planted in fertile ground. Waiting for the first water.' },
  { id:1, name:'Germinating', emoji:'💧', color:'#66BB6A', glow:'rgba(76,175,80,0.2)',   desc:'First contributions arriving. Roots begin forming underground.' },
  { id:2, name:'Sprouting',   emoji:'🌿', color:'#4CAF50', glow:'rgba(76,175,80,0.32)',  desc:'Understanding is taking shape. The shoot breaks the surface.' },
  { id:3, name:'Growing',     emoji:'🌳', color:'#2E7D32', glow:'rgba(46,125,50,0.4)',   desc:'Deep roots. Strong perspective forming. Almost ready to bloom.' },
  { id:4, name:'Bloomed',     emoji:'🌸', color:'#FFB300', glow:'rgba(255,179,0,0.45)',  desc:'This idea has bloomed. Collective knowledge, forever remembered.' },
];

function PlantSvg({ stage, blooming }) {
  const soilY = 178;
  const stemTop = [soilY-2, soilY-28, soilY-70, soilY-108, soilY-138][stage] || soilY-2;
  const rootSpread = [0, 0.4, 0.7, 1, 1][stage];
  const leafScale = [0, 0, 0.6, 1, 1][stage];
  const bloomScale = stage === 4 ? 1 : 0;

  return (
    React.createElement('svg', {
      viewBox:'0 0 300 300', width:'100%', height:'100%',
      style:{ overflow:'visible', transition:'all 0.8s cubic-bezier(0.22,1,0.36,1)' }
    },
      React.createElement('defs', null,
        React.createElement('radialGradient', { id:'soilGr', cx:'50%', cy:'0%', r:'90%' },
          React.createElement('stop', { offset:'0%', stopColor:'#3D2213' }),
          React.createElement('stop', { offset:'100%', stopColor:'#0A0503' })
        ),
        React.createElement('radialGradient', { id:'seedGlow', cx:'50%', cy:'50%', r:'50%' },
          React.createElement('stop', { offset:'0%', stopColor: stage===4?'#FFD54F':'#A5D6A7', stopOpacity:'0.7' }),
          React.createElement('stop', { offset:'100%', stopColor: stage===4?'#FFD54F':'#A5D6A7', stopOpacity:'0' })
        ),
        React.createElement('radialGradient', { id:'bloomGlow', cx:'50%', cy:'50%', r:'50%' },
          React.createElement('stop', { offset:'0%', stopColor:'#FFD54F', stopOpacity:'0.8' }),
          React.createElement('stop', { offset:'100%', stopColor:'#FF8F00', stopOpacity:'0' })
        ),
        React.createElement('filter', { id:'softGlow' },
          React.createElement('feGaussianBlur', { stdDeviation:'4', result:'b' }),
          React.createElement('feMerge', null,
            React.createElement('feMergeNode', { in:'b' }),
            React.createElement('feMergeNode', { in:'SourceGraphic' })
          )
        )
      ),

      // Soil
      React.createElement('rect', { x:0, y:soilY, width:300, height:125, fill:'url(#soilGr)' }),
      React.createElement('line', { x1:55,y1:soilY+14,x2:100,y2:soilY+11, stroke:'#3D2A16', strokeWidth:1, opacity:0.5 }),
      React.createElement('line', { x1:185,y1:soilY+18,x2:235,y2:soilY+14, stroke:'#3D2A16', strokeWidth:1, opacity:0.4 }),

      // Seed glow halo
      React.createElement('ellipse', {
        cx:150, cy:soilY, rx:stage===4?80:50, ry:stage===4?55:35,
        fill:'url(#seedGlow)',
        style:{ transition:'all 1.2s ease' }
      }),

      // ROOTS
      stage >= 1 && React.createElement('g', { opacity:rootSpread, style:{ transition:'opacity 1s' } },
        React.createElement('path', { d:'M150,182 Q150,215 148,242', stroke:'#5D4037', strokeWidth:2.5, fill:'none', strokeLinecap:'round' }),
        stage >= 2 && React.createElement('g', null,
          React.createElement('path', { d:'M149,208 Q130,220 112,236', stroke:'#5D4037', strokeWidth:1.8, fill:'none', strokeLinecap:'round' }),
          React.createElement('path', { d:'M149,212 Q168,224 188,238', stroke:'#5D4037', strokeWidth:1.8, fill:'none', strokeLinecap:'round' })
        ),
        stage >= 3 && React.createElement('g', null,
          React.createElement('path', { d:'M112,236 Q95,248 80,258', stroke:'#5D4037', strokeWidth:1.2, fill:'none', strokeLinecap:'round' }),
          React.createElement('path', { d:'M188,238 Q205,250 220,260', stroke:'#5D4037', strokeWidth:1.2, fill:'none', strokeLinecap:'round' }),
          React.createElement('path', { d:'M149,222 Q128,234 100,240', stroke:'#5D4037', strokeWidth:0.9, fill:'none', strokeLinecap:'round' }),
          React.createElement('path', { d:'M149,226 Q170,238 198,244', stroke:'#5D4037', strokeWidth:0.9, fill:'none', strokeLinecap:'round' }),
          React.createElement('path', { d:'M148,242 Q136,254 118,262', stroke:'#5D4037', strokeWidth:0.7, fill:'none', strokeLinecap:'round' }),
          React.createElement('path', { d:'M148,244 Q162,255 180,263', stroke:'#5D4037', strokeWidth:0.7, fill:'none', strokeLinecap:'round' })
        )
      ),

      // SEED
      stage === 0 && React.createElement('g', null,
        React.createElement('ellipse', {
          cx:150, cy:soilY, rx:22, ry:14, fill:'#8D6E63', filter:'url(#softGlow)',
        },
          React.createElement('animateTransform', { attributeName:'transform', type:'scale', values:'1;1.04;1', dur:'2.5s', repeatCount:'indefinite', additive:'sum' })
        ),
        React.createElement('line', { x1:150,y1:soilY-14,x2:152,y2:soilY-2, stroke:'#BCAAA4', strokeWidth:1, opacity:0.7 })
      ),
      stage >= 1 && React.createElement('g', null,
        React.createElement('ellipse', { cx:147, cy:soilY+1, rx:18, ry:12, fill:'#6D4C41' }),
        React.createElement('ellipse', { cx:153, cy:soilY+1, rx:18, ry:12, fill:'#5D4037', opacity:0.7 }),
        React.createElement('path', { d:'M143,168 L150,176 L157,168', stroke:'#3E2723', strokeWidth:1.4, fill:'none' })
      ),

      // STEM
      stage >= 1 && React.createElement('line', {
        x1:150, y1:soilY, x2:150, y2:stemTop,
        stroke: stage>=4 ? '#33691E' : '#558B2F',
        strokeWidth: stage>=3 ? 3.5 : 2.5,
        strokeLinecap:'round',
        style:{ transition:'all 1.4s cubic-bezier(0.22,1,0.36,1)' }
      }),

      // LEAVES stage 2
      stage >= 2 && React.createElement('g', {
        style:{ transformOrigin:'150px 148px', transform:'scale('+leafScale+')', transition:'transform 1.2s cubic-bezier(0.22,1,0.36,1)', opacity: leafScale }
      },
        React.createElement('ellipse', { cx:136,cy:148,rx:17,ry:8, fill:'#689F38', transform:'rotate(-35 136 148)' }),
        React.createElement('ellipse', { cx:164,cy:140,rx:17,ry:8, fill:'#7CB342', transform:'rotate(35 164 140)' })
      ),

      // LEAVES stage 3
      stage >= 3 && React.createElement('g', { opacity:1, style:{ transition:'opacity 1s 0.3s' } },
        React.createElement('ellipse', { cx:126,cy:120,rx:24,ry:10, fill:'#558B2F', transform:'rotate(-42 126 120)', filter:'url(#softGlow)' }),
        React.createElement('ellipse', { cx:174,cy:110,rx:24,ry:10, fill:'#689F38', transform:'rotate(42 174 110)', filter:'url(#softGlow)' }),
        React.createElement('ellipse', { cx:132,cy:98,rx:18,ry:8, fill:'#7CB342', transform:'rotate(-22 132 98)' }),
        React.createElement('ellipse', { cx:168,cy:92,rx:18,ry:8, fill:'#8BC34A', transform:'rotate(22 168 92)' })
      ),

      // BLOOM
      stage >= 4 && React.createElement('g', {
        style:{ transformOrigin:'150px '+stemTop+'px', transform:'scale('+bloomScale+')', transition:'transform 1.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s' }
      },
        // Bloom halo
        React.createElement('circle', { cx:150, cy:stemTop, r:52, fill:'url(#bloomGlow)' },
          React.createElement('animate', { attributeName:'r', values:'50;66;50', dur:'2.2s', repeatCount:'indefinite' }),
          React.createElement('animate', { attributeName:'opacity', values:'0.7;0.4;0.7', dur:'2.2s', repeatCount:'indefinite' })
        ),
        // Petals - 8 outer
        ...[0,45,90,135,180,225,270,315].map((deg,i) =>
          React.createElement('ellipse', {
            key:i, cx:150, cy:stemTop, rx:8, ry:22,
            fill: i%2===0 ? '#FFB300' : '#FF8F00',
            opacity:0.92,
            transform:'rotate('+deg+' 150 '+stemTop+')',
            style:{ transformOrigin:'150px '+stemTop+'px' }
          },
            React.createElement('animateTransform', {
              attributeName:'transform', type:'rotate',
              values: deg+' 150 '+stemTop+';'+(deg+3)+' 150 '+stemTop+';'+deg+' 150 '+stemTop,
              dur:'4s', repeatCount:'indefinite', additive:'sum'
            })
          )
        ),
        // Inner petals
        ...[22,67,112,157,202,247,292,337].map((deg,i) =>
          React.createElement('ellipse', {
            key:'i'+i, cx:150, cy:stemTop, rx:5, ry:14,
            fill:'#FFD54F', opacity:0.8,
            transform:'rotate('+deg+' 150 '+stemTop+')',
          })
        ),
        // Center
        React.createElement('circle', { cx:150, cy:stemTop, r:11, fill:'#FFF9C4' }),
        React.createElement('circle', { cx:150, cy:stemTop, r:6,  fill:'#FFFFFF', opacity:0.9 }),
        // Stamens
        ...[0,60,120,180,240,300].map((deg,i) => {
          const rad = deg*Math.PI/180;
          return React.createElement('circle', {
            key:'s'+i, cx:150+9*Math.cos(rad), cy:stemTop+9*Math.sin(rad), r:1.5, fill:'#FFB300'
          });
        })
      )
    )
  );
}

/* ══════════════════════════════════════════════════════
   BLOOM CELEBRATION OVERLAY
══════════════════════════════════════════════════════ */
function BloomCelebration({ onDone }) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 2200);
    const t4 = setTimeout(() => { onDone(); }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const petals = Array.from({length:16}).map((_,i) => {
    const angle = (i/16)*360;
    const dist = 120 + Math.random()*80;
    const rad = angle*Math.PI/180;
    return { x: Math.cos(rad)*dist, y: Math.sin(rad)*dist, delay: i*0.05, size: 6+Math.random()*10 };
  });

  return (
    React.createElement('div', {
      style:{
        position:'fixed', inset:0, zIndex:200,
        background: phase>=2 ? 'rgba(20,10,0,0.88)' : 'rgba(0,0,0,0)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'background 0.8s ease',
        backdropFilter: phase>=2 ? 'blur(4px)' : 'none',
      }
    },
      // Radial golden burst
      phase >= 1 && React.createElement('div', {
        style:{
          position:'absolute', width:600, height:600, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(255,179,0,0.35) 0%, rgba(255,140,0,0.15) 40%, transparent 70%)',
          animation:'bloomBurst 1.4s cubic-bezier(0.22,1,0.36,1) forwards',
        }
      }),

      // Flying petals
      phase >= 1 && petals.map((p,i) =>
        React.createElement('div', {
          key:i,
          style:{
            position:'absolute', width:p.size, height:p.size*1.6,
            background:'linear-gradient(135deg,#FFD54F,#FF8F00)',
            borderRadius:'50% 50% 50% 0',
            transform:'translate('+p.x+'px,'+p.y+'px) rotate('+((i/16)*360)+'deg)',
            opacity: phase>=3 ? 0 : 0.9,
            transition:'opacity 1s '+(1.5+p.delay)+'s ease, transform 1.2s '+p.delay+'s cubic-bezier(0.22,1,0.36,1)',
            animation:'none',
          }
        })
      ),

      // Central bloom
      phase >= 2 && React.createElement('div', {
        style:{
          position:'relative', textAlign:'center', zIndex:10,
          animation:'fadeSlideUp 0.6s ease',
        }
      },
        React.createElement('div', { style:{fontSize:96, lineHeight:1, marginBottom:20,
          filter:'drop-shadow(0 0 30px rgba(255,213,79,0.8))',
          animation:'bloomSpin 20s linear infinite'
        } }, '🌸'),
        React.createElement('h1', {
          style:{
            fontFamily:"'Fraunces',Georgia,serif", fontSize:'clamp(28px,6vw,42px)',
            fontWeight:300, color:'#FFF9C4', marginBottom:12, lineHeight:1.2
          }
        }, 'This Seed has Bloomed'),
        React.createElement('p', {
          style:{ fontSize:16, color:'rgba(255,249,196,0.7)', marginBottom:32, lineHeight:1.6 }
        }, 'Collective knowledge, forever remembered — now part of the Sacred Tree.'),

        // Contributors
        React.createElement('div', { style:{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap',marginBottom:32} },
          ['Rahul','Priya','Vivek','Meera','Akash','You'].map(name =>
            React.createElement('div', { key:name,
              style:{display:'flex',alignItems:'center',gap:6,
                background:'rgba(255,179,0,0.12)',
                border:'1px solid rgba(255,179,0,0.3)',
                borderRadius:100, padding:'6px 14px', fontSize:13, color:'#FFD54F'
              }
            },
              React.createElement(Av, { name, size:22 }),
              React.createElement('span', null, name)
            )
          )
        ),

        React.createElement('button', {
          onClick: onDone,
          style:{
            background:'linear-gradient(135deg,#FFB300,#FF8F00)',
            color:'#1A0A00', border:'none', borderRadius:100,
            padding:'13px 32px', fontSize:15, fontWeight:700,
            cursor:'pointer', fontFamily:"'Inter',sans-serif",
            boxShadow:'0 4px 24px rgba(255,179,0,0.45)',
          }
        }, '🌳 View in Sacred Tree')
      ),

      React.createElement('style', null, `
        @keyframes bloomBurst {
          0%   { transform: scale(0.2); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes bloomSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `)
    )
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 6 — SEED LIFECYCLE
══════════════════════════════════════════════════════ */

const SEED_DIMS = [
  { id:'foundations', emoji:'🧠', label:'Foundations', color:'#66BB6A', darkColor:'rgba(76,175,80,0.08)', prompt:'What is it? Why does it exist? First principles.', desc:'Explore the core idea — what it is, why it exists, what assumptions it makes.' },
  { id:'understanding', emoji:'💡', label:'Understanding', color:'#FFD54F', darkColor:'rgba(255,213,79,0.07)', prompt:'Analogies, mental models, examples, visualizations.', desc:'Make it click — share analogies, mental models, or examples that helped you.' },
  { id:'application', emoji:'🛠', label:'Application', color:'#4FC3F7', darkColor:'rgba(79,195,247,0.07)', prompt:'How does it work in reality? Production stories.', desc:'Share what you built, broke, or learned in production. Real experience only.' },
  { id:'debate', emoji:'⚖', label:'Debate', color:'#CE93D8', darkColor:'rgba(206,147,216,0.07)', prompt:'Challenge assumptions. Alternatives. Limitations.', desc:'Push back, offer alternatives, explore edge cases. Healthy tension makes ideas stronger.' },
  { id:'bloom', emoji:'🌸', label:'Bloom', color:'#FFB300', darkColor:'rgba(255,179,0,0.07)', prompt:'AI synthesis of all dimensions. Community edits it.', desc:'The living synthesis of everything the community has learned. Refine it together.' },
];

const STAGE_GUIDE = [
  {
    stage: 0, name:'Seed', emoji:'🌱',
    meaning: 'A question has been planted. The soil is fertile but nothing has grown yet.',
    signal: 'Waiting for the first roots — contributions that explore the core question.',
    advanceTo: 'Germinating',
    advanceWhen: 'When at least 2-3 people have added to Foundations or Understanding.',
    demoteMsg: 'Pull back to Seed: the question still needs clearer framing.',
  },
  {
    stage: 1, name:'Germinating', emoji:'💧',
    meaning: 'First perspectives are arriving. Roots forming underground — most work is invisible yet.',
    signal: 'Multiple contributors exploring. Understanding not yet shared.',
    advanceTo: 'Sprouting',
    advanceWhen: 'When a mental model or analogy has landed and people are building on it.',
    demoteMsg: 'Pull back to Germinating: more foundational grounding needed first.',
  },
  {
    stage: 2, name:'Sprouting', emoji:'🌿',
    meaning: 'Core understanding is taking shape. The shoot has broken the surface — visible progress.',
    signal: 'A shared mental model exists. Application stories starting to appear.',
    advanceTo: 'Growing',
    advanceWhen: 'When real implementations and healthy debate have both emerged.',
    demoteMsg: 'Pull back to Sprouting: debate is premature without shared understanding.',
  },
  {
    stage: 3, name:'Growing', emoji:'🌳',
    meaning: 'Deep roots. Multiple perspectives, real experience, productive tension in the Debate.',
    signal: 'All dimensions active. Community is forming convergent understanding.',
    advanceTo: 'Bloom',
    advanceWhen: 'When 50%+ of participants feel this is ready to become permanent knowledge.',
    demoteMsg: 'Pull back to Growing: community needs more time to reach convergence.',
  },
  {
    stage: 4, name:'Bloomed', emoji:'🌸',
    meaning: 'This idea has bloomed. Collective knowledge, permanently remembered.',
    signal: 'Knowledge is now part of the Sacred Tree.',
    advanceTo: null,
    advanceWhen: null,
    demoteMsg: null,
  },
];

const SAMPLE_NOTIFS = [
  { id:1, type:'stage', time:'2m ago', read:false, text:'Kubernetes Pods moved to 🌿 Sprouting — 7 people voted it forward.' },
  { id:2, type:'contribution', time:'5m ago', read:false, text:'Rahul added a new contribution to 🧠 Foundations.' },
  { id:3, type:'bloom', time:'12m ago', read:false, text:'5/12 people have voted to Bloom. 1 more needed.' },
  { id:4, type:'member', time:'18m ago', read:true, text:'Neha joined the Kubernetes Garden.' },
  { id:5, type:'contribution', time:'25m ago', read:true, text:'Priya added a production story to 🛠 Application.' },
  { id:6, type:'stage', time:'1h ago', read:true, text:'Meera suggested pulling back: "Core concept needs more grounding."' },
];

function NotifIcon(type) {
  if (type==='stage') return '🌿';
  if (type==='bloom') return '🌸';
  if (type==='member') return '🧑';
  return '💬';
}

function NotificationPanel({ notifs, onClose, onRead }) {
  return React.createElement('div', { style:{ position:'fixed', inset:0, zIndex:300 } },
    React.createElement('div', { onClick:onClose, style:{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' } }),
    React.createElement('div', { style:{ position:'absolute', top:0, right:0, bottom:0, width:320, background:'#0A140A', borderLeft:'1px solid rgba(76,175,80,0.18)', display:'flex', flexDirection:'column', animation:'slideInRight 0.3s cubic-bezier(0.22,1,0.36,1)' } },
      React.createElement('style', null, '@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}'),
      React.createElement('div', { style:{ padding:'20px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' } },
        React.createElement('div', null, React.createElement('h3', { style:{ fontSize:15, fontWeight:600, color:'#E8E4DC', marginBottom:3 } }, '🔔 Notifications'), React.createElement('p', { style:{ fontSize:10, color:'#3A4438' } }, '🌿 stage · 🌸 bloom · 💬 contribution · 🧑 member joined')),
        React.createElement('button', { onClick:onClose, style:{ background:'none', border:'none', color:'#5A6456', fontSize:20, cursor:'pointer', lineHeight:1 } }, '×')
      ),
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'12px' } },
        notifs.map(n =>
          React.createElement('div', { key:n.id, onClick:()=>onRead(n.id),
            style:{ padding:'12px', borderRadius:10, marginBottom:8, cursor:'pointer', background: n.read?'transparent':'rgba(76,175,80,0.06)', border:'1px solid '+(n.read?'rgba(255,255,255,0.05)':'rgba(76,175,80,0.18)'), transition:'all 0.2s' }
          },
            React.createElement('div', { style:{ display:'flex', gap:8, alignItems:'flex-start' } },
              React.createElement('span', { style:{ fontSize:16, flexShrink:0, marginTop:1 } }, NotifIcon(n.type)),
              React.createElement('div', null,
                React.createElement('p', { style:{ fontSize:13, color: n.read?'#7A8A78':'#D8D4CC', lineHeight:1.5 } }, n.text),
                React.createElement('p', { style:{ fontSize:11, color:'#3A4438', marginTop:4 } }, n.time)
              ),
              !n.read && React.createElement('div', { style:{ width:7, height:7, borderRadius:'50%', background:'#4CAF50', flexShrink:0, marginTop:4 } })
            )
          ),

          // Add contributor
          React.createElement('div', { style:{ marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)' } },
            // Extra contributors added
            (extraContribs[bloom.id]||[]).map((c,i) => {
              const key2 = bloom.id+'-extra-'+i;
              const endorsed2 = myEndorsements[key2];
              const count2 = (endorsements[bloom.id]?.[c.name]||0);
              return React.createElement('div', { key:i, style:{ display:'flex', gap:10, alignItems:'center', padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' } },
                React.createElement('div', { style:{ width:32, height:32, borderRadius:'50%', background:'rgba(76,175,80,0.2)', border:'1px solid rgba(76,175,80,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 } }, c.name[0].toUpperCase()),
                React.createElement('div', { style:{ flex:1 } },
                  React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
                    React.createElement('span', { style:{ fontSize:13, fontWeight:600, color:'#D8D4CC' } }, c.name),
                    React.createElement('span', { style:{ fontSize:10, color:'rgba(76,175,80,0.5)', background:'rgba(76,175,80,0.07)', borderRadius:100, padding:'1px 6px' } }, 'New')
                  ),
                  React.createElement('span', { style:{ fontSize:11, color:'#4A5848' } }, c.role+' · '+c.email)
                ),
                React.createElement('button', {
                  onClick:()=>endorse(bloom.id, c.name, key2),
                  disabled:endorsed2,
                  style:{ padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:600, cursor:endorsed2?'default':'pointer', background:endorsed2?'rgba(255,213,79,0.12)':'rgba(255,255,255,0.05)', border:'1px solid '+(endorsed2?'rgba(255,213,79,0.35)':'rgba(255,255,255,0.1)'), color:endorsed2?'#FFD54F':'#7A8A78', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }
                }, endorsed2?'\u2746 Endorsed':'Endorse')
              );
            }),

            addingTo === bloom.id
              ? React.createElement('div', { style:{ background:'rgba(76,175,80,0.06)', border:'1px solid rgba(76,175,80,0.2)', borderRadius:12, padding:'14px', marginTop:8 } },
                  React.createElement('p', { style:{ fontSize:11, fontWeight:600, color:'#4CAF50', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 } }, 'Add a contributor'),
                  React.createElement('input', {
                    autoFocus:true, value:addEmail, onChange:e=>setAddEmail(e.target.value),
                    placeholder:'Email or name (e.g. rahul@company.com)',
                    onKeyDown:e=>{ if(e.key==='Enter') addContributor(bloom.id); },
                    style:{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(76,175,80,0.25)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#E8E4DC', fontFamily:"'Inter',sans-serif", outline:'none', marginBottom:8 }
                  }),
                  React.createElement('input', {
                    value:addRole, onChange:e=>setAddRole(e.target.value),
                    placeholder:'Their role (e.g. Added production examples)',
                    onKeyDown:e=>{ if(e.key==='Enter') addContributor(bloom.id); },
                    style:{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(76,175,80,0.25)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#E8E4DC', fontFamily:"'Inter',sans-serif", outline:'none', marginBottom:10 }
                  }),
                  React.createElement('div', { style:{ display:'flex', gap:8 } },
                    React.createElement('button', { onClick:()=>setAddingTo(null), style:{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#7A8A78', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13 } }, 'Cancel'),
                    React.createElement('button', { onClick:()=>addContributor(bloom.id), disabled:!addEmail.trim(), style:{ flex:2, padding:'8px', borderRadius:8, background:addEmail.trim()?'#4CAF50':'rgba(255,255,255,0.06)', color:addEmail.trim()?'#060A06':'rgba(255,255,255,0.2)', border:'none', cursor:addEmail.trim()?'pointer':'default', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600 } }, '+ Add to Lineage')
                  )
                )
              : React.createElement('button', {
                  onClick:()=>setAddingTo(bloom.id),
                  style:{ width:'100%', marginTop:8, padding:'10px', borderRadius:10, background:'rgba(76,175,80,0.05)', border:'1.5px dashed rgba(76,175,80,0.25)', color:'rgba(76,175,80,0.7)', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:500, transition:'all 0.2s' }
                }, '+ Add a contributor to this Bloom')
          )
        )
      )
    )
  );
}

function StageVoteModal({ currentStage, direction, onVote, onClose }) {
  const guide = STAGE_GUIDE[currentStage];
  const [reason, setReason] = React.useState('');
  const reasonOpts = direction === 'forward'
    ? ['A clear mental model has emerged', 'Real implementations were shared', 'Healthy debate is happening', 'Community is converging']
    : ['Core concept still unclear', 'Not enough perspectives yet', 'Debate is premature', 'Missing real-world examples'];

  return React.createElement('div', { style:{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center', animation:'fadeIn 0.2s' } },
    React.createElement('div', { style:{ background:'#0D160D', border:'1px solid rgba(76,175,80,0.2)', borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:640, animation:'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)' } },
      React.createElement('div', { style:{ width:40, height:4, background:'rgba(255,255,255,0.1)', borderRadius:2, margin:'0 auto 20px' } }),
      React.createElement('p', { style:{ fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color: direction==='forward'?'#66BB6A':'#CE93D8', marginBottom:8 } },
        direction==='forward' ? '→ Move to '+guide.advanceTo : '← Pull back to previous stage'
      ),
      React.createElement('h3', { style:{ fontFamily:"'Fraunces',Georgia,serif", fontSize:20, fontWeight:300, color:'#F0EDE6', marginBottom:8 } },
        direction==='forward' ? 'What made you feel it is ready?' : 'Why does it need more time?'
      ),
      React.createElement('p', { style:{ fontSize:13, color:'#5A6456', marginBottom:18, lineHeight:1.5 } },
        direction==='forward' ? guide.advanceWhen : guide.demoteMsg
      ),
      React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 } },
        reasonOpts.map(opt =>
          React.createElement('button', { key:opt, onClick:()=>setReason(opt),
            style:{ padding:'11px 14px', borderRadius:10, textAlign:'left', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13, transition:'all 0.18s', background: reason===opt?(direction==='forward'?'rgba(76,175,80,0.15)':'rgba(206,147,216,0.15)'):'rgba(255,255,255,0.04)', border:'1.5px solid '+(reason===opt?(direction==='forward'?'#66BB6A':'#CE93D8'):'rgba(255,255,255,0.09)'), color: reason===opt?(direction==='forward'?'#66BB6A':'#CE93D8'):'#9A9A8A' }
          }, opt)
        )
      ),
      React.createElement('div', { style:{ display:'flex', gap:10 } },
        React.createElement('button', { onClick:onClose, style:{ flex:1, padding:'12px', borderRadius:100, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#7A8A78', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:14 } }, 'Cancel'),
        React.createElement('button', { onClick:()=>{ onVote(direction, reason); onClose(); },
          style:{ flex:2, padding:'12px', borderRadius:100, background: direction==='forward'?'#4CAF50':'rgba(206,147,216,0.8)', color:'#060A06', border:'none', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:600 }
        }, direction==='forward' ? '→ Move forward' : '← Pull back')
      )
    )
  );
}

function ConvergenceSignal({ contributions }) {
  const foundCount = contributions.filter(c => c.dim==='foundations'||c.dim==='understanding').length;
  const debateCount = contributions.filter(c => c.dim==='debate').length;
  const total = contributions.length;
  if (total === 0) return null;

  const debateRatio = debateCount / total;
  const isConverging = debateRatio < 0.25 && total >= 3;
  const isDiverging = debateRatio > 0.4;
  const isBuilding = !isConverging && !isDiverging;

  const [label, color, dotColor] = isConverging
    ? ['Converging', '#66BB6A', '#4CAF50']
    : isDiverging
    ? ['Diverging', '#CE93D8', '#BA68C8']
    : ['Building', '#FFD54F', '#FFB300'];

  return React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'rgba(255,255,255,0.03)', borderRadius:100, border:'1px solid rgba(255,255,255,0.07)', marginBottom:12 } },
    React.createElement('div', { style:{ width:8, height:8, borderRadius:'50%', background:dotColor, boxShadow:'0 0 6px '+dotColor },
    },
      React.createElement('style', null, '.conv-pulse{animation:pulse 2s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}')
    ),
    React.createElement('span', { style:{ fontSize:12, color, fontWeight:500 } }, label),
    React.createElement('span', { style:{ fontSize:11, color:'#3A4438' } }, '·'),
    React.createElement('span', { style:{ fontSize:11, color:'#3A4438' } },
      isConverging ? 'Community is aligning on core understanding'
      : isDiverging ? 'Active disagreement — productive tension'
      : 'Multiple perspectives forming — keep going'
    )
  );
}

const BLOOM_SYNTHESIS = 'Pods are Kubernetes’s atomic scheduling unit — a wrapper around one or more containers that share a network namespace and storage. The key insight: Kubernetes schedules Pods, not individual containers, enabling co-located containers (like app + logging sidecar) to communicate via localhost without service discovery overhead. This abstraction pays off at scale and with sidecar patterns, though it adds unnecessary complexity for single-container simple deployments.';

const REACTION_VOTERS = {
  click:  ['Rahul','Vivek'],
  beauty: ['Priya','Akash','Meera'],
  mind:   ['Siva','Rahul','Vivek','Priya'],
  impl:   ['Priya','Meera'],
  ref:    ['Akash'],
  confuse:[],
};


function DimThread({ dim, contributions, onAdd }) {
  const [replyingTo, setReplyingTo] = React.useState(null);
  const [hoveredReaction, setHoveredReaction] = React.useState(null); // idx of contribution being replied to
  const [replyText, setReplyText] = React.useState('');
  const [reactions, setReactions] = React.useState({}); // key: "contribIdx-reactionKey"
  const [editingBloom, setEditingBloom] = React.useState(false);
  const [bloomText, setBloomText] = React.useState(BLOOM_SYNTHESIS);
  const textRef = React.useRef(null);

  const REACTION_OPTS = [
    { key:'click',  emoji:'💥', label:'It clicked'        },
    { key:'beauty', emoji:'✨', label:'Beautifully said'  },
    { key:'mind',   emoji:'🧠', label:'Changed thinking'  },
    { key:'impl',   emoji:'🛠', label:'I tried this'      },
    { key:'ref',    emoji:'📚', label:'Great reference'   },
    { key:'confuse',emoji:'🤔', label:'Still confused'    },
  ];

  const toggleReaction = (contribIdx, key) => {
    const rKey = contribIdx+'-'+key;
    setReactions(r => ({ ...r, [rKey]: !r[rKey] }));
  };

  const mine = contributions.filter(c => c.dim === dim.id);

  const postReply = (parentIdx) => {
    if (!replyText.trim()) return;
    onAdd(dim.id, replyText.trim(), parentIdx);
    setReplyText('');
    setReplyingTo(null);
  };

  if (dim.id === 'bloom') {
    return React.createElement('div', { style:{ padding:'0 0 24px' } },
      // Bloom synthesis card
      React.createElement('div', { style:{ background:'rgba(255,179,0,0.06)', border:'1px solid rgba(255,179,0,0.22)', borderRadius:14, padding:'18px', marginBottom:16 } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 } },
          React.createElement('span', { style:{ fontSize:12, fontWeight:600, color:'#FFB300', letterSpacing:'0.08em', textTransform:'uppercase' } }, '🌸 Bloom v1 · AI Synthesis'),
          React.createElement('button', { onClick:()=>setEditingBloom(e=>!e), style:{ fontSize:12, color:'#FFB300', background:'rgba(255,179,0,0.12)', border:'1px solid rgba(255,179,0,0.3)', borderRadius:100, padding:'4px 12px', cursor:'pointer', fontFamily:"'Inter',sans-serif" } }, editingBloom?'Save':'Edit')
        ),
        editingBloom
          ? React.createElement('textarea', { value:bloomText, onChange:e=>setBloomText(e.target.value), style:{ width:'100%', background:'rgba(255,179,0,0.04)', border:'1px solid rgba(255,179,0,0.2)', borderRadius:8, padding:'12px', fontSize:14, color:'#E8E4DC', fontFamily:"'Inter',sans-serif", lineHeight:1.7, resize:'none', minHeight:120, outline:'none' }, rows:6 })
          : React.createElement('p', { style:{ fontSize:13.5, lineHeight:1.75, color:'#B8B4AC' } }, bloomText),
        React.createElement('p', { style:{ fontSize:11, color:'rgba(255,179,0,0.45)', fontStyle:'italic', marginTop:10 } }, 'Synthesized from 🧠 Foundations · 💡 Understanding · 🛠 Application · ⚖ Debate')
      ),
      // Suggest improvement
      React.createElement(RichCompose, { placeholder:'Suggest an improvement to this Bloom...', color:'#FFB300', onSubmit:t=>onAdd(dim.id,t) })
    );
  }

  return React.createElement('div', { style:{ paddingBottom:24 } },
    // Empty state
    mine.length === 0 && React.createElement('div', { style:{ textAlign:'center', padding:'28px 16px 20px', color:'rgba(255,255,255,0.18)', fontSize:13, fontStyle:'italic', lineHeight:1.6 } },
      React.createElement('div', { style:{ fontSize:28, marginBottom:8 } }, dim.emoji),
      dim.desc||dim.prompt
    ),

    // Contributions (flat, with inline replies)
    mine.map((c, idx) => {
      const replies = mine.filter(r => r.parentIdx === idx);
      const isTopLevel = c.parentIdx === undefined || c.parentIdx === null;
      if (!isTopLevel) return null; // rendered as child

      return React.createElement('div', { key:idx, style:{ marginBottom:16 } },
        // Main contribution card
        React.createElement('div', { style:{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 15px' } },
          // Author row
          React.createElement('div', { style:{ display:'flex', gap:8, alignItems:'center', marginBottom:10 } },
            React.createElement(Av, { name:c.author, size:28 }),
            React.createElement('div', null,
              React.createElement('span', { style:{ fontSize:13.5, fontWeight:600, color:'#E0DCD4', display:'block' } }, c.author),
              React.createElement('span', { style:{ fontSize:10.5, color:'rgba(255,255,255,0.28)' } }, c.time)
            ),
            React.createElement('span', { style:{ marginLeft:'auto', fontSize:11, color:dim.color, background:dim.darkColor, borderRadius:100, padding:'2px 8px', fontWeight:500 } }, dim.emoji+' '+dim.label)
          ),
          // Text
          React.createElement('p', { style:{ fontSize:13.5, lineHeight:1.72, color:'#B0AC9E', marginBottom:12 } }, c.text),
          // Reaction row with tooltip + voter list
          React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 } },
            REACTION_OPTS.map(r => {
              const rKey = idx+'-'+r.key;
              const active = reactions[rKey];
              const voters = REACTION_VOTERS[r.key] || [];
              const allVoters = active ? [...voters, 'You'] : voters;
              const isHov = hoveredReaction === rKey;
              return React.createElement('div', { key:r.key, style:{ position:'relative' } },
                React.createElement('button', {
                  onClick:()=>toggleReaction(idx,r.key),
                  onMouseEnter:()=>setHoveredReaction(rKey),
                  onMouseLeave:()=>setHoveredReaction(null),
                  style:{
                    display:'flex', alignItems:'center', gap:3,
                    padding:'4px 9px', borderRadius:100, fontSize:12, cursor:'pointer', transition:'all 0.15s',
                    background:active?'rgba(76,175,80,0.18)':'rgba(255,255,255,0.05)',
                    border:'1px solid '+(active?'rgba(76,175,80,0.4)':'rgba(255,255,255,0.08)'),
                    color:active?'#66BB6A':'#5A6456', fontFamily:"'Inter',sans-serif"
                  }
                }, r.emoji, React.createElement('span',{style:{fontSize:10,color:active?'#66BB6A':'#3A4438'}},(allVoters.length||''))),
                isHov && React.createElement('div', { style:{ position:'absolute', bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)', background:'rgba(10,18,10,0.97)', border:'1px solid rgba(76,175,80,0.25)', borderRadius:8, padding:'7px 10px', zIndex:50, whiteSpace:'nowrap', minWidth:120, boxShadow:'0 4px 16px rgba(0,0,0,0.5)', backdropFilter:'blur(8px)' } },
                  React.createElement('p', { style:{ fontSize:11.5, fontWeight:600, color:'#E8E4DC', marginBottom: allVoters.length?5:0 } }, r.emoji+' '+r.label),
                  allVoters.length > 0 && React.createElement('p', { style:{ fontSize:10.5, color:'#66BB6A' } }, allVoters.join(', '))
                )
              );
            })
          ),
          // Reply button
          React.createElement('div', { style:{ display:'flex', gap:8, alignItems:'center' } },
            React.createElement('button', {
              onClick:()=>{ setReplyingTo(replyingTo===idx?null:idx); setReplyText(''); },
              style:{ fontSize:11.5, color:'#5A6456', background:'none', border:'none', cursor:'pointer', fontFamily:"'Inter',sans-serif", padding:'2px 4px', transition:'color 0.15s' }
            }, replyingTo===idx?'Cancel reply':'↩ Reply'),
            React.createElement('span', { style:{ color:'rgba(255,255,255,0.08)' } }, '·'),
            React.createElement('button', {
              onClick:()=>{ playNatureSound('chirp'); setReactions(r=>({...r,[idx+'-endorse']:true})); },
              style:{ fontSize:11.5, color:reactions[idx+'-endorse']?'#FFD54F':'#5A6456', background:'none', border:'none', cursor:'pointer', fontFamily:"'Inter',sans-serif", padding:'2px 4px', transition:'color 0.2s' }
            }, reactions[idx+'-endorse']?'✦ Endorsed':'✦ Endorse')
          )
        ),

        // Inline replies (indented)
        replies.length > 0 && React.createElement('div', { style:{ marginTop:8, marginLeft:24, display:'flex', flexDirection:'column', gap:8 } },
          replies.map((r, ri) =>
            React.createElement('div', { key:ri, style:{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 13px' } },
              React.createElement('div', { style:{ display:'flex', gap:7, alignItems:'center', marginBottom:7 } },
                React.createElement(Av, { name:r.author, size:22 }),
                React.createElement('span', { style:{ fontSize:12.5, fontWeight:600, color:'#C8C4BC' } }, r.author),
                React.createElement('span', { style:{ fontSize:10, color:'rgba(255,255,255,0.22)', marginLeft:'auto' } }, r.time)
              ),
              React.createElement('p', { style:{ fontSize:13, lineHeight:1.65, color:'#9A9690' } }, r.text)
            )
          )
        ),

        // Reply compose (appears below the card when reply is open)
        replyingTo===idx && React.createElement('div', { style:{ marginTop:8, marginLeft:24, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, overflow:'hidden' } },
          React.createElement('div', { style:{ display:'flex', gap:8, alignItems:'center', padding:'10px 12px 6px' } },
            React.createElement(Av, { name:'You', size:22 }),
            React.createElement('span', { style:{ fontSize:11.5, color:'rgba(255,255,255,0.28)' } }, 'Reply to '+c.author+'...')
          ),
          React.createElement('textarea', {
            autoFocus:true,
            value:replyText, onChange:e=>setReplyText(e.target.value),
            placeholder:'Add your reply...',
            style:{ width:'100%', background:'transparent', border:'none', outline:'none', padding:'4px 12px 10px', fontSize:13, color:'#E8E4DC', fontFamily:"'Inter',sans-serif", lineHeight:1.65, resize:'none', minHeight:60 },
            rows:2,
            onKeyDown:e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); postReply(idx); } }
          }),
          React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 12px', borderTop:'1px solid rgba(255,255,255,0.06)' } },
            React.createElement('span', { style:{ fontSize:10, color:'rgba(255,255,255,0.2)' } }, 'Enter to send'),
            React.createElement('button', { onClick:()=>postReply(idx), disabled:!replyText.trim(),
              style:{ background:replyText.trim()?dim.color:'rgba(255,255,255,0.07)', color:replyText.trim()?'#060A06':'rgba(255,255,255,0.3)', border:'none', borderRadius:100, padding:'6px 16px', fontSize:12, fontWeight:600, cursor:replyText.trim()?'pointer':'default', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }
            }, 'Reply')
          )
        )
      );
    }),

    // New top-level contribution
    React.createElement('div', { style:{ marginTop:mine.length>0?16:0 } },
      React.createElement(RichCompose, { placeholder:dim.prompt, color:dim.color, onSubmit:t=>onAdd(dim.id,t) })
    )
  );
}


function StageVotingRows({ stageVotes, myStageVote, dominantStage, totalVotes, onVote }) {
  const [hovered, setHovered] = React.useState(null);
  return React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:5 } },
    STAGES.map((s,i) => {
      const votes = stageVotes[i]||0;
      const pct = totalVotes>0 ? Math.round(votes/totalVotes*100) : 0;
      const isMe = myStageVote===i;
      const isDom = i===dominantStage && votes>0;
      const isHov = hovered===i;
      const g = STAGE_GUIDE[i];
      return React.createElement("div", { key:i,
        onMouseEnter:()=>setHovered(i), onMouseLeave:()=>setHovered(null),
        style:{ borderRadius:10,
          background:isMe?s.darkColor||"rgba(76,175,80,0.1)":isHov?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.025)",
          border:"1.5px solid "+(isMe?s.color:isHov?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.05)"),
          transition:"all 0.2s", overflow:"hidden" }
      },
        React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:6, padding:"8px 10px" } },
          React.createElement("span", { style:{ fontSize:15, flexShrink:0 } }, s.emoji),
          React.createElement("div", { style:{ flex:1, minWidth:0 } },
            React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:6 } },
              React.createElement("span", { style:{ fontSize:12.5, color:isMe?s.color:isHov?"#E0DCD4":"#9A9A8A", fontWeight:isMe||isHov||isDom?600:400, transition:"color 0.15s" } }, s.name),
              isMe && React.createElement("span", { style:{ fontSize:10, color:s.color, background:"rgba(76,175,80,0.15)", borderRadius:100, padding:"1px 7px", fontWeight:700 } }, "\u2714 voted")
            ),
            React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:5, marginTop:3 } },
              React.createElement("div", { style:{ flex:1, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" } },
                React.createElement("div", { style:{ height:"100%", width:pct+"%", background:isMe?s.color:isDom?s.color+"88":"rgba(255,255,255,0.1)", borderRadius:2, transition:"width 0.5s cubic-bezier(0.22,1,0.36,1)" } })
              ),
              React.createElement("span", { style:{ fontSize:10, color:isMe?s.color:isDom?s.color:"#4A5848", fontWeight:600, flexShrink:0, width:26, textAlign:"right" } }, pct>0?pct+"%":"")
            )
          )
        ),
        (isHov||isMe) && React.createElement("div", { style:{ padding:"4px 10px 10px", borderTop:"1px solid "+(s.color+"28") } },
          React.createElement("p", { style:{ fontSize:11, color:isMe?s.color:"#A0A890", lineHeight:1.5, marginBottom:isMe?0:8 } }, g.meaning),
          !isMe && React.createElement("p", { style:{ fontSize:10.5, color:"#5A6456", lineHeight:1.45, marginBottom:8, fontStyle:"italic" } }, g.signal),
          !isMe && React.createElement("button", {
            onClick:()=>onVote(i),
            style:{ padding:"6px 14px", background:s.color, color:"#060A06", border:"none", borderRadius:100, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Inter',sans-serif", transition:"all 0.18s" }
          }, "\u2714 Vote for "+s.name)
        )
      );
    })
  );
}

/* ── Rich Compose Editor ── */
function RichCompose({ placeholder, color, onSubmit }) {
  const editorRef = React.useRef(null);
  const [hasContent, setHasContent] = React.useState(false);
  const [showPH, setShowPH] = React.useState(true);
  const cmd = (c,v) => { document.execCommand(c, false, v||null); editorRef.current && editorRef.current.focus(); };
  const check = () => {
    const t = editorRef.current ? editorRef.current.innerText.trim() : "";
    setHasContent(t.length>0); setShowPH(t.length===0);
  };
  const submit = () => {
    const t = editorRef.current ? editorRef.current.innerText.trim() : "";
    if (!t) return;
    onSubmit(t);
    editorRef.current.innerHTML="";
    setHasContent(false); setShowPH(true);
  };
  const TB = { background:"none", border:"none", color:"#7A8A78", cursor:"pointer", padding:"4px 7px", borderRadius:5, fontSize:13, fontFamily:"'Inter',sans-serif", transition:"all 0.15s", display:"inline-flex", alignItems:"center" };
  return React.createElement("div", { style:{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, overflow:"hidden" } },
    React.createElement("div", { style:{ display:"flex", alignItems:"center", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", gap:4, flexWrap:"wrap" } },
      React.createElement("button", { style:Object.assign({},TB,{fontWeight:700}), onClick:()=>cmd("bold"), title:"Bold" }, "B"),
      React.createElement("button", { style:Object.assign({},TB,{fontStyle:"italic"}), onClick:()=>cmd("italic"), title:"Italic" }, "I"),
      React.createElement("button", { style:Object.assign({},TB,{fontFamily:"monospace",fontSize:11}), onClick:()=>cmd("formatBlock","pre"), title:"Code" }, "</>"),
      React.createElement("button", { style:TB, onClick:()=>cmd("formatBlock","blockquote"), title:"Quote" }, "\u201c\u201d"),
      React.createElement("div", { style:{ width:1, height:14, background:"rgba(255,255,255,0.1)", margin:"0 2px" } }),
      React.createElement("button", { style:TB, title:"Link", onClick:()=>{ const u=window.prompt("URL:"); if(u) cmd("createLink",u); } }, "\ud83d\udd17"),
      React.createElement("button", { style:TB, title:"Attach file", onClick:()=>{ const el=document.createElement("input"); el.type="file"; el.click(); } }, "\ud83d\udcce"),
      React.createElement("button", { style:TB, title:"Photo", onClick:()=>{ const el=document.createElement("input"); el.type="file"; el.accept="image/*"; el.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>cmd("insertImage",ev.target.result); r.readAsDataURL(f); }; el.click(); } }, "\ud83d\uddbc\ufe0f"),
      React.createElement("button", { style:TB, title:"Print", onClick:()=>window.print() }, "\ud83d\udda8\ufe0f")
    ),
    React.createElement("div", { style:{ position:"relative", minHeight:80 } },
      showPH && React.createElement("div", { style:{ position:"absolute", top:12, left:14, color:"rgba(255,255,255,0.2)", fontSize:13.5, fontFamily:"'Inter',sans-serif", pointerEvents:"none", lineHeight:1.6 } }, placeholder),
      React.createElement("div", {
        ref:editorRef,
        contentEditable:true,
        suppressContentEditableWarning:true,
        onInput:check,
        style:{ outline:"none", padding:"12px 14px", fontSize:13.5, color:"#E8E4DC", fontFamily:"'Inter',sans-serif", lineHeight:1.7, minHeight:80, whiteSpace:"pre-wrap" }
      })
    ),
    React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderTop:"1px solid rgba(255,255,255,0.06)" } },
      React.createElement("span", { style:{ fontSize:10.5, color:"#3A4438" } }, "Cmd+B bold \xb7 Cmd+I italic \xb7 </> code"),
      React.createElement("button", { onClick:submit, disabled:!hasContent,
        style:{ background:hasContent?color:"rgba(255,255,255,0.06)", color:hasContent?"#060A06":"rgba(255,255,255,0.2)", border:"none", borderRadius:100, padding:"8px 20px", fontSize:13, fontWeight:600, cursor:hasContent?"pointer":"default", fontFamily:"'Inter',sans-serif", transition:"all 0.2s" }
      }, "Contribute")
    )
  );
}



/* ── Mobile Seed View ── */
function MobileSeedView({ stageVotes, myStageVote, dominantStage, totalVotes, stage, stageData, guide, bloomVoteCount, bloomThreshold, bloomPct, dimsWithContribs, contributions, activeDim, setActiveDim, castStageVote, addContrib, notifs, unreadCount, setShowNotifs, setShowStatusModal, showBloom, blooming, go, stageToasts, watcherCount=9, incomingToasts=[] }) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const dimCount = (id) => contributions.filter(c=>c.dim===id).length;
  const currentDim = SEED_DIMS.find(d=>d.id===activeDim);
  const bloomNeeded = Math.max(0, bloomThreshold - bloomVoteCount);

  return React.createElement('div', { style:{ height:'100vh', background:'#040904', color:'#E8E4DC', fontFamily:"'Inter',sans-serif", display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' } },

    // Ambient glow
    React.createElement('div', { style:{ position:'fixed', top:'20%', left:'50%', transform:'translate(-50%,-50%)', width:380, height:380, borderRadius:'50%', background:'radial-gradient(circle,'+stageData.glow+' 0%,transparent 70%)', pointerEvents:'none', zIndex:0, transition:'background 1.5s ease', filter:'blur(35px)' } }),

    // Nav
    React.createElement('div', { style:{ flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 16px', background:'rgba(4,9,4,0.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.06)', zIndex:10 } },
      React.createElement('button', { onClick:()=>go('gardenHome'), style:{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:100, padding:'5px 12px', color:'#9A9A8A', fontSize:12.5, cursor:'pointer', fontFamily:"'Inter',sans-serif" } }, '← Seeds'),
      React.createElement('span', { style:{ fontSize:11, color:'#4CAF50', fontWeight:600, letterSpacing:'0.1em' } }, '🌱 Kubernetes'),
      React.createElement('div', { style:{ display:'flex', gap:6 } },
        React.createElement('button', { onClick:()=>{if(unreadCount>0)playNatureSound('wind');setShowNotifs(true);}, style:{ position:'relative', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:100, padding:'5px 10px', color:'#9A9A8A', fontSize:13, cursor:'pointer', fontFamily:"'Inter',sans-serif" } },
          '🔔',
          unreadCount>0 && React.createElement('span', { style:{ position:'absolute', top:-4, right:-4, width:14, height:14, borderRadius:'50%', background:'#4CAF50', fontSize:9, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 } }, unreadCount)
        )
      )
    ),

    // Scrollable body
    React.createElement('div', { style:{ flex:1, overflowY:'auto', position:'relative', zIndex:1, paddingBottom: sheetOpen ? 320 : 80 } },

      // Question
      React.createElement('div', { style:{ padding:'18px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' } },
        React.createElement('p', { style:{ fontSize:10, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'#4CAF50', marginBottom:7 } }, '🌱 Seed by Siva · 18 participants'),
        React.createElement('h1', { style:{ fontFamily:"'Fraunces',Georgia,serif", fontSize:'clamp(17px,5vw,24px)', fontWeight:300, lineHeight:1.3, color:'#F0EDE6' } }, SEED_DATA.question)
      ),

      // Stage timeline (compact horizontal)
      React.createElement('div', { style:{ padding:'14px 16px 8px' } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:0, marginBottom:10 } },
          STAGES.map((s,i) => React.createElement(React.Fragment, { key:i },
            React.createElement('button', { onClick:()=>castStageVote(i), style:{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'0 2px', flexShrink:0 } },
              React.createElement('div', { style:{ width:i===stage?32:22, height:22, borderRadius:100, background:i<stage?'rgba(76,175,80,0.22)':i===stage?s.color:'rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, transition:'all 0.4s', border:'1.5px solid '+(i===stage?s.color:'transparent'), boxShadow:i===stage?'0 0 8px '+s.glow:'none' } }, s.emoji),
              React.createElement('span', { style:{ fontSize:8, color:i===stage?s.color:'#2A3428', fontWeight:i===stage?600:400, whiteSpace:'nowrap' } }, s.name)
            ),
            i<4 && React.createElement('div', { style:{ flex:1, height:1.5, background:i<stage?'rgba(76,175,80,0.35)':'rgba(255,255,255,0.07)', marginBottom:12, minWidth:10 } })
          ))
        ),
        // Current stage meaning
        React.createElement('p', { style:{ fontSize:11, color:'#7A8A78', fontStyle:'italic', lineHeight:1.5 } }, guide.meaning),
        React.createElement(ConvergenceSignal, { contributions })
      ),

      // Plant centered
      React.createElement('div', { style:{ display:'flex', justifyContent:'center', padding:'10px 0' } },
        React.createElement('div', { style:{ width:200, height:200 } },
          React.createElement(PlantSvg, { stage, blooming })
        )
      ),

      // Compact bloom bar
      React.createElement('div', { style:{ margin:'0 16px 16px', padding:'12px 14px', background:'rgba(255,179,0,0.05)', border:'1px solid '+(bloomVoteCount>=bloomThreshold?'rgba(255,179,0,0.35)':'rgba(255,255,255,0.07)'), borderRadius:12 } },
        React.createElement('div', { style:{ display:'flex', justifyContent:'space-between', marginBottom:6 } },
          React.createElement('span', { style:{ fontSize:11, color:'#5A6456' } }, '🌸 Bloom votes'),
          React.createElement('span', { style:{ fontSize:11, fontWeight:600, color:bloomVoteCount>=bloomThreshold?'#FFB300':'#5A6456' } }, bloomVoteCount+'/'+bloomThreshold)
        ),
        React.createElement('div', { style:{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden', marginBottom:8 } },
          React.createElement('div', { style:{ height:'100%', width:(bloomVoteCount/bloomThreshold*100)+'%', background:'linear-gradient(to right,#FFB300,#FF8F00)', borderRadius:2, transition:'width 0.6s' } })
        ),
        React.createElement('button', { onClick:()=>castStageVote(4), disabled:myStageVote===4,
          style:{ width:'100%', padding:'9px', borderRadius:9, background:myStageVote===4?'rgba(255,179,0,0.12)':bloomVoteCount>=bloomThreshold?'linear-gradient(135deg,#FFB300,#FF8F00)':'rgba(255,179,0,0.08)', color:myStageVote===4?'#FFB300':bloomVoteCount>=bloomThreshold?'#0A0500':'#FFB300', border:'1px solid '+(myStageVote===4?'rgba(255,179,0,0.3)':'rgba(255,179,0,0.2)'), fontSize:13, fontWeight:600, cursor:myStageVote===4?'default':'pointer', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }
        }, myStageVote===4?'✔ Voted to Bloom':'🌸 Vote to Bloom')
      )
    ),

    // Bottom sheet (dimension thread)
    sheetOpen && React.createElement('div', { style:{ position:'fixed', bottom:64, left:0, right:0, height:320, background:'#0A140A', borderTop:'1px solid rgba(76,175,80,0.2)', borderRadius:'20px 20px 0 0', zIndex:20, display:'flex', flexDirection:'column', animation:'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)' } },
      React.createElement('div', { style:{ padding:'10px 16px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6 } },
          React.createElement('span', { style:{ fontSize:16 } }, currentDim?currentDim.emoji:''),
          React.createElement('span', { style:{ fontSize:13, fontWeight:600, color:currentDim?currentDim.color:'#fff' } }, currentDim?currentDim.label:''),
          React.createElement('span', { style:{ fontSize:11, color:'#4A5848', fontStyle:'italic', marginLeft:4 } }, currentDim?currentDim.prompt:'')
        ),
        React.createElement('button', { onClick:()=>setSheetOpen(false), style:{ background:'none', border:'none', color:'#5A6456', fontSize:20, cursor:'pointer', lineHeight:1 } }, '×')
      ),
      React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'10px 14px 0', background:currentDim?currentDim.darkColor:'transparent' } },
        currentDim && React.createElement(DimThread, { key:activeDim, dim:currentDim, contributions, onAdd:addContrib })
      )
    ),

    // Bottom tab bar
    React.createElement('div', { style:{ position:'fixed', bottom:0, left:0, right:0, height:64, background:'rgba(6,12,6,0.97)', backdropFilter:'blur(16px)', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:20, padding:'0 8px' } },
      SEED_DIMS.map(d => {
        const isActive = activeDim===d.id && sheetOpen;
        const cnt = contributions.filter(c=>c.dim===d.id).length;
        return React.createElement('button', { key:d.id,
          onClick:()=>{ setActiveDim(d.id); setSheetOpen(true); },
          style:{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'8px 6px', flex:1 }
        },
          React.createElement('div', { style:{ position:'relative' } },
            React.createElement('span', { style:{ fontSize:isActive?20:17, transition:'font-size 0.2s' } }, d.emoji),
            cnt>0 && React.createElement('span', { style:{ position:'absolute', top:-4, right:-6, fontSize:9, background:isActive?d.color:'rgba(255,255,255,0.15)', color:isActive?'#060A06':'#9A9A8A', borderRadius:100, padding:'1px 4px', fontWeight:700 } }, cnt)
          ),
          React.createElement('span', { style:{ fontSize:9, color:isActive?d.color:'#3A4438', fontWeight:isActive?600:400, transition:'all 0.2s' } }, d.label)
        );
      })
    ),

    // Toasts
    React.createElement('div', { style:{ position:'fixed', top:58, left:'50%', transform:'translateX(-50%)', zIndex:150, display:'flex', flexDirection:'column', gap:6, pointerEvents:'none', alignItems:'center' } },
      stageToasts.map(t => React.createElement('div', { key:t.id, style:{ background:'rgba(8,18,8,0.97)', border:'1px solid rgba(76,175,80,0.3)', borderRadius:100, padding:'8px 18px', fontSize:12.5, color:'#A8D8A8', fontFamily:"'Inter',sans-serif", animation:'fadeSlideUp 0.35s ease', backdropFilter:'blur(12px)', whiteSpace:'nowrap' } }, t.msg))
    )
  );
}

function S6_Seed({ go }) {
  const [isMobile, setIsMobile] = React.useState(typeof window!=='undefined'&&window.innerWidth<700);
  const [watcherCount, setWatcherCount] = React.useState(9);
  const [autoBloomFired, setAutoBloomFired] = React.useState(false);
  const [incomingToasts, setIncomingToasts] = React.useState([]);
  React.useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<700);
    window.addEventListener('resize',fn);
    return()=>window.removeEventListener('resize',fn);
  },[]);

  // Simulate other watchers fluctuating
  React.useEffect(()=>{
    const t = setInterval(()=>{
      setWatcherCount(w => Math.max(6, Math.min(18, w + (Math.random()>0.5?1:-1))));
    }, 3500);
    return ()=>clearInterval(t);
  },[]);

  // Simulate another person's vote approaching bloom — fires after 18 seconds
  React.useEffect(()=>{
    if (autoBloomFired) return;
    const names = ['Priya','Rahul','Akash','Vivek'];
    // Show "X is voting" toast at 10s
    const t1 = setTimeout(()=>{
      const name = names[Math.floor(Math.random()*names.length)];
      const id = Date.now();
      setIncomingToasts(ts=>[...ts,{id,msg:name+' is reviewing this seed... \ud83c\udf31'}]);
      setTimeout(()=>setIncomingToasts(ts=>ts.filter(t=>t.id!==id)),3500);
    }, 10000);
    // Auto-vote at 18s if not already bloomed
    const t2 = setTimeout(()=>{
      if (autoBloomFired) return;
      setAutoBloomFired(true);
      const name = names[Math.floor(Math.random()*names.length)];
      const id = Date.now();
      setIncomingToasts(ts=>[...ts,{id,msg:'\ud83c\udf38 '+name+' just voted to Bloom!'}]);
      setTimeout(()=>setIncomingToasts(ts=>ts.filter(t=>t.id!==id)),4000);
      // Increment bloom votes — this should tip it over
      setStageVotes(vs=>({...vs,4:(vs[4]||0)+1}));
      // Check and trigger bloom
      setStageVotes(vs=>{
        const nv=(vs[4]||0);
        if(nv>=10&&!autoBloomFired){
          playNatureSound('bloom');
          setTimeout(()=>{setBlooming(true);setTimeout(()=>setShowBloom(true),900);},400);
        }
        return vs;
      });
    }, 18000);
    return ()=>{ clearTimeout(t1); clearTimeout(t2); };
  },[autoBloomFired]);
  const [stageVotes, setStageVotes] = React.useState({ 0:0, 1:1, 2:6, 3:3, 4:10 });
  const [myStageVote, setMyStageVote] = React.useState(null);
  const [totalParticipants] = React.useState(18);
  const [showBloom, setShowBloom] = React.useState(false);
  const [blooming, setBlooming] = React.useState(false);
  const [showStatusModal, setShowStatusModal] = React.useState(false);
  const [statusVote, setStatusVote] = React.useState(null);
  const [activeDim, setActiveDim] = React.useState('foundations');
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [notifs, setNotifs] = React.useState(SAMPLE_NOTIFS);
  const [stageToasts, setStageToasts] = React.useState([]);
  const [contributions, setContributions] = React.useState([
    { dim:'foundations', author:'Rahul', time:'2h ago', text:'Pods exist because Kubernetes needed to co-locate containers sharing a network namespace. Two containers in the same Pod communicate via localhost — impossible across separate containers.' },
    { dim:'foundations', author:'Vivek', time:'1h ago', text:'The scheduler is the key reason. Kubernetes needed an atomic unit it could schedule, move, restart. A Pod is that unit — containers inside it are always co-scheduled together.' },
    { dim:'understanding', author:'Vivek', time:'45m ago', text:'Think of a Pod like a server. Containers are processes on that server. The server has one IP, all processes share it. Kubernetes schedules servers (Pods), not individual processes.' },
    { dim:'application', author:'Priya', time:'1h ago', text:'In production we run a logging sidecar in every Pod — main app port 3000, log forwarder on localhost:5001. Without Pods you would need a full service mesh just for this.' },
    { dim:'debate', author:'Meera', time:'30m ago', text:'For small single-container deployments this abstraction adds complexity with no benefit. It only pays off at scale or with sidecar patterns. Worth acknowledging this upfront.' },
  ]);

  const totalVotes = Object.values(stageVotes).reduce((s,v)=>s+v,0);
  const dominantStage = Object.entries(stageVotes).reduce((best,[k,v]) => v>(stageVotes[best]||0)?parseInt(k):best, 2);
  const stage = myStageVote !== null ? myStageVote : dominantStage;
  const stageData = STAGES[stage];
  const guide = STAGE_GUIDE[stage];
  const bloomVoteCount = stageVotes[4]||0;
  const bloomThreshold = Math.ceil(totalParticipants * 0.6); // 60% — high bar
  const bloomPct = Math.round(bloomVoteCount/totalParticipants*100);
  const dimsWithContribs = new Set(contributions.map(c=>c.dim)).size;
  const unreadCount = notifs.filter(n=>!n.read).length;

  const addToast = (msg) => {
    const id = Date.now();
    setStageToasts(ts=>[...ts,{id,msg}]);
    setTimeout(()=>setStageToasts(ts=>ts.filter(t=>t.id!==id)),3500);
  };

  const castStageVote = (stageIdx) => {
    if (myStageVote===stageIdx) return;
    setStageVotes(vs => {
      const next={...vs};
      if (myStageVote!==null) next[myStageVote]=Math.max(0,(next[myStageVote]||0)-1);
      next[stageIdx]=(next[stageIdx]||0)+1;
      return next;
    });
    setMyStageVote(stageIdx);
    addToast(STAGES[stageIdx].emoji+' You feel: '+STAGES[stageIdx].name);
    setNotifs(ns=>[{id:Date.now(),type:'stage',time:'just now',read:false,text:'You voted this seed is at '+STAGES[stageIdx].emoji+' '+STAGES[stageIdx].name+'.'},...ns]);
    if (stageIdx===4) {
      const nv=(stageVotes[4]||0)+1;
      if (nv>=bloomThreshold && dimsWithContribs>=3) {
        playNatureSound('bloom');
        setTimeout(()=>{setBlooming(true);setTimeout(()=>setShowBloom(true),900);},400);
      }
    }
  };

  const addContrib = (dim, text, parentIdx) => {
    setContributions(cs=>[...cs,{dim,author:'You',time:'just now',text,parentIdx:parentIdx!==undefined?parentIdx:null}]);
    const d=SEED_DIMS.find(d=>d.id===dim);
    setNotifs(ns=>[{id:Date.now(),type:'contribution',time:'just now',read:false,text:'You added to '+d.emoji+' '+d.label+'.'},...ns]);
  };

  const dimCount = (id) => contributions.filter(c=>c.dim===id).length;
  const currentDim = SEED_DIMS.find(d=>d.id===activeDim);
  const bloomReady = bloomVoteCount>=bloomThreshold && dimsWithContribs>=4;
  const bloomNeeded = Math.max(0, bloomThreshold - bloomVoteCount);

  return React.createElement(React.Fragment, null,
    showStatusModal && React.createElement(SeedStatusModal,{currentVote:statusVote,onVote:v=>setStatusVote(v),onClose:()=>setShowStatusModal(false)}),
    showNotifs && React.createElement(NotificationPanel,{notifs,onClose:()=>setShowNotifs(false),onRead:id=>setNotifs(ns=>ns.map(n=>n.id===id?{...n,read:true}:n))}),
    showBloom && React.createElement(BloomCelebration,{onDone:()=>{setShowBloom(false);go('tree');}}),

    // Toasts
    React.createElement('div',{style:{position:'fixed',top:58,left:'50%',transform:'translateX(-50%)',zIndex:150,display:'flex',flexDirection:'column',gap:6,pointerEvents:'none',alignItems:'center'}},
      stageToasts.map(t=>React.createElement('div',{key:t.id,style:{background:'rgba(8,18,8,0.97)',border:'1px solid rgba(76,175,80,0.3)',borderRadius:100,padding:'8px 18px',fontSize:12.5,color:'#A8D8A8',fontFamily:"'Inter',sans-serif",animation:'fadeSlideUp 0.35s ease',backdropFilter:'blur(12px)',whiteSpace:'nowrap'}},t.msg)),
      incomingToasts.map(t=>React.createElement('div',{key:'i'+t.id,style:{background:'rgba(10,20,8,0.97)',border:'1px solid rgba(255,179,0,0.4)',borderRadius:100,padding:'8px 18px',fontSize:12.5,color:'#FFD54F',fontFamily:"'Inter',sans-serif",animation:'fadeSlideUp 0.35s ease',backdropFilter:'blur(12px)',whiteSpace:'nowrap'}},t.msg))
    ),

    isMobile && React.createElement(MobileSeedView,{ stageVotes, myStageVote, dominantStage, totalVotes, stage, stageData, guide, bloomVoteCount, bloomThreshold, bloomPct, dimsWithContribs, contributions, activeDim, setActiveDim, castStageVote, addContrib, notifs, unreadCount, setShowNotifs, setShowStatusModal, showBloom, blooming, go, stageToasts }),
    !isMobile && React.createElement('div',{style:{height:'100vh',background:'#040904',color:'#E8E4DC',fontFamily:"'Inter',sans-serif",display:'flex',flexDirection:'column',overflow:'hidden'}},

      // NAV
      React.createElement('div',{style:{flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 18px',background:'rgba(4,9,4,0.95)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(255,255,255,0.06)',zIndex:10}},
        React.createElement('button',{onClick:()=>go('gardenHome'),style:{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:100,padding:'5px 13px',color:'#9A9A8A',fontSize:12.5,cursor:'pointer',fontFamily:"'Inter',sans-serif"}},'← Seeds'),
        React.createElement('span',{style:{fontSize:12,color:'#4CAF50',fontWeight:600,letterSpacing:'0.1em'}},'🌱 Kubernetes Garden'),
        React.createElement('div',{style:{display:'flex',gap:7,alignItems:'center'}},
          React.createElement('button',{onClick:()=>{if(unreadCount>0)playNatureSound('wind');setShowNotifs(true);},style:{position:'relative',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:100,padding:'5px 11px',color:'#9A9A8A',fontSize:13,cursor:'pointer',fontFamily:"'Inter',sans-serif"}},
            '🔔',
            unreadCount>0&&React.createElement('span',{style:{position:'absolute',top:-5,right:-5,width:15,height:15,borderRadius:'50%',background:'#4CAF50',fontSize:9,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}},unreadCount)
          ),
          React.createElement('button',{onClick:()=>setShowStatusModal(true),style:{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:100,padding:'5px 11px',color:'#9A9A8A',fontSize:13,cursor:'pointer',fontFamily:"'Inter',sans-serif"}},'🌿')
        )
      ),

      // MAIN 2-COLUMN BODY
      React.createElement('div',{style:{flex:1,display:'flex',overflow:'hidden',gap:0}},

        // ── LEFT: CONVERSATION ──
        React.createElement('div',{style:{flex:'1 1 0',display:'flex',flexDirection:'column',borderRight:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}},

          // Question
          React.createElement('div',{style:{flexShrink:0,padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.015)'}},
            React.createElement('p',{style:{fontSize:10,fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase',color:'#4CAF50',marginBottom:7}},'🌱 Seed · by Siva · '+totalParticipants+' participants'),
            React.createElement('h1',{style:{fontFamily:"'Fraunces',Georgia,serif",fontSize:'clamp(16px,2.8vw,22px)',fontWeight:300,lineHeight:1.3,color:'#F0EDE6',margin:0}},SEED_DATA.question)
          ),

          // Dimension tabs
          React.createElement('div',{style:{flexShrink:0,display:'flex',overflowX:'auto',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.01)'}},
            SEED_DIMS.map(d=>React.createElement('button',{key:d.id,onClick:()=>setActiveDim(d.id),
              style:{display:'flex',alignItems:'center',gap:4,padding:'10px 14px',background:'none',border:'none',cursor:'pointer',
                fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:activeDim===d.id?600:400,
                color:activeDim===d.id?d.color:'#4A5848',
                borderBottom:'2px solid '+(activeDim===d.id?d.color:'transparent'),
                marginBottom:'-1px',whiteSpace:'nowrap',transition:'all 0.18s',flexShrink:0}
            },
              React.createElement('span',null,d.emoji),
              React.createElement('span',null,d.label),
              dimCount(d.id)>0&&React.createElement('span',{style:{fontSize:9,background:activeDim===d.id?d.color:'rgba(255,255,255,0.08)',color:activeDim===d.id?'#0A0A0A':'#4A5848',borderRadius:100,padding:'1px 5px',fontWeight:700,marginLeft:2}},dimCount(d.id))
            ))
          ),

          // Dim description
          currentDim && React.createElement('div',{style:{flexShrink:0,padding:'8px 16px',background:currentDim.darkColor,borderBottom:'1px solid rgba(255,255,255,0.05)'}},
            React.createElement('p',{style:{fontSize:11.5,color:currentDim.color,opacity:0.7,lineHeight:1.5,margin:0,fontStyle:'italic'}},currentDim.prompt)
          ),

          // Thread (scrollable)
          React.createElement('div',{style:{flex:1,overflowY:'auto',padding:'14px 16px 0',background:currentDim?currentDim.darkColor:'transparent',transition:'background 0.3s'}},
            currentDim&&React.createElement(DimThread,{key:activeDim,dim:currentDim,contributions,onAdd:addContrib})
          )
        ),

        // ── RIGHT: PLANT + VOTING ──
        React.createElement('div',{style:{width:'clamp(260px,42%,380px)',flexShrink:0,display:'flex',flexDirection:'column',overflowY:'auto',background:'rgba(4,10,4,0.5)'}},

          // Ambient glow
          React.createElement('div',{style:{position:'absolute',top:'30%',right:'10%',width:280,height:280,borderRadius:'50%',background:'radial-gradient(circle,'+stageData.glow+' 0%,transparent 70%)',pointerEvents:'none',zIndex:0,transition:'background 1.5s ease',filter:'blur(30px)'}}),

          // Plant
          React.createElement('div',{style:{padding:'16px 16px 4px',position:'relative',zIndex:1,display:'flex',alignItems:'center',justifyContent:'center'}},
            React.createElement('div',{style:{width:'min(260px,100%)',aspectRatio:'1'}},
              React.createElement(PlantSvg,{stage,blooming})
            )
          ),

          // Stage label
          React.createElement('div',{style:{textAlign:'center',padding:'0 16px 12px',position:'relative',zIndex:1}},
            React.createElement('div',{style:{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:100,padding:'5px 12px',marginBottom:6}},
              React.createElement('span',{style:{fontSize:13}},''),
              React.createElement('span',{style:{fontSize:12,color:stageData.color,fontWeight:600}},stageData.emoji+' '+stageData.name)
            ),
            React.createElement('p',{style:{fontSize:11,color:'#7A8A78',lineHeight:1.5}},guide.meaning)
          ),

          // Stage voting
          React.createElement('div',{style:{padding:'0 14px 14px',position:'relative',zIndex:1}},
            React.createElement('p',{style:{fontSize:10,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'#4CAF50',marginBottom:8}},
              'Community feels · ',
              React.createElement('span',{style:{color:'#3A4438',fontWeight:400}},totalVotes+'/'+totalParticipants)
            ),
            React.createElement(StageVotingRows,{stageVotes,myStageVote,dominantStage,totalVotes,onVote:castStageVote}),
            myStageVote===null&&React.createElement('p',{style:{fontSize:11,color:'#4A5848',fontStyle:'italic',textAlign:'center',padding:'4px 0'}},'Tap a stage to vote → watch the plant respond')
          ),

          // Convergence
          React.createElement('div',{style:{padding:'0 14px 10px',zIndex:1,position:'relative'}},
            React.createElement(ConvergenceSignal,{contributions})
          ),

          // BLOOM section
          React.createElement('div',{style:{margin:'0 14px 20px',padding:'14px',background: bloomReady?'rgba(255,179,0,0.1)':'rgba(255,255,255,0.03)',border:'1px solid '+(bloomReady?'rgba(255,179,0,0.4)':'rgba(255,255,255,0.07)'),borderRadius:14,position:'relative',zIndex:1,transition:'all 0.5s'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6,marginBottom:10}},
            React.createElement('span',{style:{fontSize:11,color:'#4A5848'}},'\ud83d\udc41 '+watcherCount+' watching'),
            React.createElement('div',{style:{width:5,height:5,borderRadius:'50%',background:'#4CAF50',boxShadow:'0 0 5px #4CAF50'}})
          ),
          React.createElement('p',{style:{fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:bloomReady?'#FFB300':'#5A6456',marginBottom:8}},'🌸 Bloom · High bar'),
            // Bar
            React.createElement('div',{style:{height:6,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden',marginBottom:7}},
              React.createElement('div',{style:{height:'100%',width:(bloomVoteCount/bloomThreshold*100)+'%',background: bloomReady?'linear-gradient(to right,#FFD54F,#FF8F00)':'rgba(255,179,0,0.4)',borderRadius:3,transition:'width 0.7s cubic-bezier(0.22,1,0.36,1)'}})
            ),
            React.createElement('p',{style:{fontSize:10.5,color:bloomReady?'#FFB300':'#5A6456',marginBottom:10}},
              bloomReady ? '🌸 Ready to Bloom! '+bloomVoteCount+'/'+bloomThreshold+' voted.'
              : bloomVoteCount+'/'+bloomThreshold+' votes needed ('+bloomNeeded+' more)'
            ),
            // Requirements
            React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:5,marginBottom:12}},
              React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6}},
                React.createElement('div',{style:{width:14,height:14,borderRadius:'50%',background:bloomVoteCount>=bloomThreshold?'#4CAF50':'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},
                  bloomVoteCount>=bloomThreshold&&React.createElement('span',{style:{fontSize:8,color:'#fff'}},'✓')
                ),
                React.createElement('span',{style:{fontSize:10.5,color:bloomVoteCount>=bloomThreshold?'#66BB6A':'#4A5848'}},bloomVoteCount+'/'+bloomThreshold+' participants voted Bloom')
              ),
              React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6}},
                React.createElement('div',{style:{width:14,height:14,borderRadius:'50%',background:dimsWithContribs>=4?'#4CAF50':'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},
                  dimsWithContribs>=4&&React.createElement('span',{style:{fontSize:8,color:'#fff'}},'✓')
                ),
                React.createElement('span',{style:{fontSize:10.5,color:dimsWithContribs>=4?'#66BB6A':'#4A5848'}},dimsWithContribs+'/4 dimensions have contributions')
              )
            ),
            // Bloom vote button
            React.createElement('button',{
              onClick:()=>castStageVote(4),
              disabled:myStageVote===4,
              style:{width:'100%',padding:'10px',borderRadius:10,cursor:myStageVote===4?'default':'pointer',fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,transition:'all 0.25s',
                background:myStageVote===4?'rgba(255,179,0,0.12)':bloomReady?'linear-gradient(135deg,#FFB300,#FF8F00)':'rgba(255,179,0,0.08)',
                color:myStageVote===4?'#FFB300':bloomReady?'#0A0500':'#FFB300',
                border:'1.5px solid '+(myStageVote===4?'rgba(255,179,0,0.3)':bloomReady?'transparent':'rgba(255,179,0,0.2)'),
                boxShadow:bloomReady&&myStageVote!==4?'0 4px 16px rgba(255,179,0,0.3)':'none'}
            }, myStageVote===4?'✓ You voted to Bloom':'🌸 Vote to Bloom'),

            bloomReady&&React.createElement('p',{style:{fontSize:10,color:'#FFB300',opacity:0.7,textAlign:'center',marginTop:6,fontStyle:'italic'}},
              'The garden is ready. Contribute to all dimensions to Bloom.'
            )
          )
        )
      )
    )
  );
}


/* ══════════════════════════════════════════════════════
   SCREEN 7 — BLOOM PROPOSAL
══════════════════════════════════════════════════════ */
function S7_BloomProposal({ go, back }) {
  const [review, setReview] = useState(null);
  const opts = [
    { e:"🌸", l:"This captures what we learnt.", v:14 },
    { e:"🌿", l:"Almost, one point is missing.", v:6 },
    { e:"🌱", l:"Not yet, we're still exploring.", v:2 },
  ];
  return (
    <ScenePage stage="bloom" sceneH={195} onBack={back} step={7} total={8}>
      <p className="eyebrow" style={{marginBottom:10}}>Bloom Proposal v1</p>
      <h1 className="serif-lg" style={{marginBottom:18}}>The community's best understanding, distilled.</h1>
      <div className="g-card g-card-bloom" style={{marginBottom:16}}>
        <p style={{fontSize:14,fontWeight:600,color:C.bloom,marginBottom:9}}>🌸 Kubernetes for Beginners</p>
        <p className="body-sm" style={{marginBottom:8}}>Kubernetes is a container orchestration platform. It solves the problem of running, scaling, and managing containerised apps across many machines.</p>
        <p className="body-sm" style={{marginBottom:8}}><strong>Where to begin:</strong> Pods → Services → Deployments. Run on Minikube locally first.</p>
        <p className="body-sm" style={{marginBottom:8}}><strong>The mental model:</strong> Kubernetes is a desired-state engine. Declare what you want; it makes it happen.</p>
        <p className="body-sm"><strong>What made it click:</strong> Deploying a broken app and watching Kubernetes self-heal it.</p>
      </div>
      <p className="caption" style={{marginBottom:14}}>Written by Priya · Reviewed by 5 participants</p>
      <p className="body" style={{marginBottom:13,fontWeight:500,color:C.ink}}>Does this capture what we collectively learned?</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:22}}>
        {opts.map(o=>(
          <button key={o.l} className={`s-opt ${review===o.l?"on-bloom":""}`}
            onClick={()=>setReview(o.l)}>
            <span style={{fontSize:17}}>{o.e}</span>
            <span style={{flex:1,textAlign:"left"}}>{o.l}</span>
            <span style={{fontSize:11.5,opacity:0.55}}>{o.v}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-bloom" onClick={()=>go("bloom")} disabled={!review}
        style={{opacity:review?1:0.4,width:"100%",justifyContent:"center"}}>
        🌸 See the Bloom
      </button>
    </ScenePage>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 8 — BLOOM (with celebration)
══════════════════════════════════════════════════════ */
function S8_Bloom({ go, back }) {
  const [phase, setPhase] = useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1),100);
    const t2=setTimeout(()=>setPhase(2),800);
    const t3=setTimeout(()=>setPhase(3),1600);
    return ()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);

  return (
    <div className="app">
      <div className="garden-bg" style={{background: phase>=2 ? "url('assets/garden-scene.png') center/cover" : "url('assets/garden-scene.png') center/cover", filter: phase>=2 ? "sepia(0.3) saturate(1.4)" : "none", transition:"filter 1.2s ease"}}/>
      <div className="garden-overlay"/>
      <Fireflies/>
      <div className="scene-header" style={{height:210, position:"relative", zIndex:3}}>
        <GardenScene height={210} stage="bloom"/>
        <div className="scene-nav">
          <button className="nav-back" onClick={back}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <span className="nav-logo">🌱 Rhyza</span>
          <div style={{display:"flex",gap:4,background:"rgba(7,14,7,0.75)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:100,padding:"5px 9px"}}>
            {Array.from({length:8}).map((_,i)=>(
              <div key={i} style={{width:i===7?15:5,height:5,borderRadius:3,background:i<8?C.accentBright:"rgba(255,255,255,0.1)",transition:"all 0.3s"}}/>
            ))}
          </div>
        </div>
      </div>
      <div className="content-panel" style={{position:"relative",zIndex:3}}>
        {/* Bloom icon with ripples */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",paddingTop:8,marginBottom:26}}>
          <div style={{position:"relative",width:100,height:100,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
            {phase>=1 && <><div className="bloom-ripple" style={{position:"absolute"}}/><div className="bloom-ripple bloom-ripple-2" style={{position:"absolute"}}/><div className="bloom-ripple bloom-ripple-3" style={{position:"absolute"}}/></>}
            <div style={{fontSize:64,lineHeight:1,opacity:phase>=1?1:0,animation:phase>=1?"bloomUnfurl 1.2s cubic-bezier(0.22,1,0.36,1) forwards":"none"}}>
              🌸
            </div>
          </div>
          <h1 className="serif-xl" style={{marginBottom:9,opacity:phase>=2?1:0,transform:phase>=2?"translateY(0)":"translateY(8px)",transition:"all 0.5s ease 0.2s"}}>
            Kubernetes for Beginners<br/>has Bloomed.
          </h1>
          <p className="body" style={{maxWidth:360,marginBottom:5,opacity:phase>=3?1:0,transition:"opacity 0.5s ease"}}>
            Not because time passed. Not because a manager approved it.
          </p>
          <p className="serif-md" style={{color:C.bloom,fontStyle:"italic",marginBottom:22,opacity:phase>=3?1:0,transition:"opacity 0.5s ease 0.1s"}}>
            Because the community reached shared understanding.
          </p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",opacity:phase>=3?1:0,transition:"opacity 0.5s ease 0.2s"}}>
            <span className="pill pill-amber">🌸 Bloomed · 3 weeks</span>
            <span className="pill pill-green">12 participants</span>
            <span className="pill pill-grey">47 contributions</span>
          </div>
        </div>

        <div className="g-card g-card-bloom" style={{marginBottom:13,opacity:phase>=3?1:0,transition:"opacity 0.6s ease 0.4s"}}>
          <p className="eyebrow" style={{marginBottom:8,color:C.bloom}}>The Bloom</p>
          <p className="body-sm" style={{marginBottom:7}}>Start with the problem: too many containers, too many machines, impossible to manage by hand. Kubernetes is the answer.</p>
          <p className="body-sm" style={{marginBottom:7}}>Run Minikube. Deploy something. Break it. Watch it heal. <em>That</em> is when it clicks.</p>
          <p className="body-sm">This Bloom is your starting point — not the end. Plant a new Seed for what you want to learn next.</p>
        </div>
        <p className="caption" style={{textAlign:"center",marginBottom:18,opacity:phase>=3?1:0,transition:"opacity 0.5s ease 0.5s"}}>
          Every new learner in this Garden begins here now.
        </p>
        <button className="btn btn-grow" onClick={()=>go("tree")} style={{width:"100%",justifyContent:"center",opacity:phase>=3?1:0,transition:"opacity 0.5s ease 0.6s"}}>
          🌳 See the Sacred Tree
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SCREEN 9 — SACRED TREE
══════════════════════════════════════════════════════ */

const BLOOMS = [
  { id:1, title:'Kubernetes Pods', latestVersion:'v3', prevVersions:['v1','v2'],
    summary:'Pods are Kubernetes\u2019s atomic scheduling unit — containers sharing network+storage. The scheduler treats a Pod as one thing, enabling sidecar patterns via localhost.',
    bloomDate:'Jun 25, 2026', branchPos:{ left:'48%', top:'22%' },
    contributors:[
      { name:'Siva',  emoji:'\ud83c\udf31', role:'Planted the Seed',             endorsements:12 },
      { name:'Rahul', emoji:'\ud83e\udde0', role:'First-principles explanation',  endorsements:28 },
      { name:'Vivek', emoji:'\ud83d\udcd6', role:'Server analogy that made it click', endorsements:24 },
      { name:'Priya', emoji:'\ud83d\udee0', role:'Production sidecar story',      endorsements:18 },
      { name:'Meera', emoji:'\u2696',        role:'Counter-argument (complexity)', endorsements:9  },
    ],
    dims:{ foundations:2, understanding:1, application:1, debate:1 },
  },
  { id:2, title:'Kubernetes Deployments', latestVersion:'v2', prevVersions:['v1'],
    summary:'Deployments manage ReplicaSets declaratively. Key: readiness probes, graceful shutdown, PodDisruptionBudgets. Rolling updates with maxUnavailable=0 ensure zero-downtime.',
    bloomDate:'Jun 22, 2026', branchPos:{ left:'26%', top:'38%' },
    contributors:[
      { name:'Meera', emoji:'\ud83c\udf31', role:'Planted the Seed',      endorsements:8  },
      { name:'Rahul', emoji:'\ud83e\udde0', role:'Added depth',            endorsements:14 },
      { name:'Priya', emoji:'\ud83d\udee0', role:'Production patterns',   endorsements:19 },
    ],
    dims:{ foundations:1, understanding:1, application:2, debate:0 },
  },
  { id:3, title:'Init Containers', latestVersion:'v1', prevVersions:[],
    summary:'Init containers run sequentially before app containers. Use cases: DB migration, config seeding, waiting on dependencies. They share the Pod\u2019s volumes but have separate images.',
    bloomDate:'Jun 18, 2026', branchPos:{ left:'66%', top:'33%' },
    contributors:[
      { name:'Akash', emoji:'\ud83c\udf31', role:'Planted the Seed',      endorsements:7  },
      { name:'Vivek', emoji:'\ud83d\udcd6', role:'Explained clearly',     endorsements:11 },
    ],
    dims:{ foundations:1, understanding:1, application:0, debate:0 },
  },
];

function S9_Tree({ back, go, goProfile }) {
  const [selected, setSelected] = React.useState(null);
  const [extraContribs, setExtraContribs] = React.useState({});  // bloomId -> [{name, email, role}]
  const [addingTo, setAddingTo] = React.useState(null); // bloomId being added to
  const [addEmail, setAddEmail] = React.useState('');
  const [addRole, setAddRole] = React.useState('');

  const addContributor = (bloomId) => {
    if (!addEmail.trim()) return;
    const name = addEmail.includes('@') ? addEmail.split('@')[0] : addEmail.trim();
    const display = addEmail.includes('@') ? addEmail : addEmail.trim();
    setExtraContribs(e => ({
      ...e,
      [bloomId]: [...(e[bloomId]||[]), { name, email:display, role:addRole.trim()||'Contributor', endorsements:0 }]
    }));
    // Also seed endorsements for new person
    setEndorsements(e => ({...e, [bloomId]: {...(e[bloomId]||{}), [name]:0}}));
    setAddEmail('');
    setAddRole('');
    setAddingTo(null);
    playNatureSound('chirp');
  };

  const [endorsements, setEndorsements] = React.useState(() => {
    const init = {};
    BLOOMS.forEach(b => { init[b.id] = Object.fromEntries(b.contributors.map(c=>[c.name, c.endorsements])); });
    return init;
  });
  const [myEndorsements, setMyEndorsements] = React.useState({});

  const endorse = (bloomId, name, customKey) => {
    const key = customKey || bloomId+'-'+name;
    if (myEndorsements[key]) return;
    playNatureSound('chirp');
    setMyEndorsements(m=>({...m,[key]:true}));
    setEndorsements(e=>({...e,[bloomId]:{...e[bloomId],[name]:(e[bloomId][name]||0)+1}}));
  };

  const bloom = selected!==null ? BLOOMS.find(b=>b.id===selected) : null;

  return React.createElement('div', { style:{ height:'100vh', fontFamily:"'Inter',sans-serif", display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' } },

    // Magical tree background
    React.createElement('div', { style:{ position:'absolute', inset:0, backgroundImage:"url('assets/sacred-tree-dark.png')", backgroundSize:'contain', backgroundPosition:'center center', backgroundRepeat:'no-repeat', zIndex:0 } }),
    // Dark overlay
    React.createElement('div', { style:{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 40%, rgba(0,0,0,0.4) 100%)', zIndex:1 } }),

    // Nav
    React.createElement('div', { style:{ position:'relative', zIndex:10, flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', background:'rgba(2,8,2,0.7)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,0.08)' } },
      React.createElement('button', { onClick:back, style:{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:100, padding:'6px 14px', color:'#D8D4CC', fontSize:13, cursor:'pointer', fontFamily:"'Inter',sans-serif" } }, '← Garden'),
      React.createElement('span', { style:{ fontFamily:"'Fraunces',Georgia,serif", fontSize:17, color:'#F0EDE6', fontWeight:300, letterSpacing:'0.02em' } }, '🌳 Sacred Tree'),
      React.createElement('span', { style:{ fontSize:12, color:'rgba(255,255,255,0.4)' } }, BLOOMS.length+' Blooms')
    ),

    // Body
    React.createElement('div', { style:{ flex:1, display:'flex', position:'relative', overflow:'hidden' } },

      // Tree scene — clickable blooms
      React.createElement('div', { style:{ flex:1, position:'relative', zIndex:2 } },

        // Bloom flowers on branches
        ...BLOOMS.map(b => {
          const isSelected = selected===b.id;
          return React.createElement('button', {
            key:b.id,
            onClick:()=>setSelected(isSelected?null:b.id),
            style:{
              position:'absolute',
              left:b.branchPos.left, top:b.branchPos.top,
              transform:'translate(-50%,-50%) scale('+(isSelected?1.25:1)+')',
              background:'none', border:'none', cursor:'pointer', padding:0,
              transition:'transform 0.3s cubic-bezier(0.22,1,0.36,1)', zIndex:3,
            }
          },
            React.createElement('div', { style:{ position:'relative' } },
              // Glow halo
              React.createElement('div', { style:{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:isSelected?80:56, height:isSelected?80:56, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,213,79,0.5) 0%,transparent 70%)', transition:'all 0.3s', pointerEvents:'none' } }),
              // Flower
              React.createElement('div', { style:{ fontSize:isSelected?32:26, display:'block', filter:'drop-shadow(0 0 12px rgba(255,213,79,0.8))', transition:'font-size 0.3s', lineHeight:1, position:'relative', zIndex:1 } }, '🌸'),
              // Version badge
              React.createElement('div', { style:{ position:'absolute', top:-10, right:-14, fontSize:9.5, background:'rgba(255,179,0,0.95)', color:'#0A0500', borderRadius:100, padding:'2px 6px', fontWeight:700, whiteSpace:'nowrap', fontFamily:"'Inter',sans-serif" } }, b.latestVersion),
              // Title tooltip
              !isSelected && React.createElement('div', { style:{ position:'absolute', bottom:-28, left:'50%', transform:'translateX(-50%)', fontSize:10, color:'rgba(255,255,255,0.85)', background:'rgba(0,0,0,0.6)', borderRadius:100, padding:'2px 8px', whiteSpace:'nowrap', fontFamily:"'Inter',sans-serif", backdropFilter:'blur(4px)' } }, b.title)
            )
          );
        }),

        // Bottom legend
        React.createElement('div', { style:{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', textAlign:'center', zIndex:3 } },
          React.createElement('p', { style:{ fontSize:12, color:'rgba(255,255,255,0.35)', fontStyle:'italic' } }, 'Tap a 🌸 to explore its knowledge lineage')
        )
      ),

      // Detail panel
      bloom && React.createElement('div', { style:{ width:360, flexShrink:0, background:'rgba(4,10,4,0.95)', backdropFilter:'blur(20px)', borderLeft:'1px solid rgba(76,175,80,0.2)', display:'flex', flexDirection:'column', overflowY:'auto', zIndex:10, animation:'slideInRight 0.3s cubic-bezier(0.22,1,0.36,1)' } },
        React.createElement('style', null, '@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}'),

        React.createElement('div', { style:{ padding:'20px 18px' } },
          // Header
          React.createElement('div', { style:{ display:'flex', alignItems:'start', justifyContent:'space-between', marginBottom:14 } },
            React.createElement('div', null,
              React.createElement('span', { style:{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'#FFB300', display:'block', marginBottom:5 } }, '🌸 '+bloom.latestVersion+' · '+bloom.bloomDate),
              React.createElement('h2', { style:{ fontFamily:"'Fraunces',Georgia,serif", fontSize:20, fontWeight:300, lineHeight:1.3, color:'#F0EDE6', margin:0 } }, bloom.title)
            ),
            React.createElement('button', { onClick:()=>setSelected(null), style:{ background:'none', border:'none', color:'#5A6456', fontSize:22, cursor:'pointer', lineHeight:1, flexShrink:0 } }, '×')
          ),

          // Version history
          bloom.prevVersions.length>0 && React.createElement('div', { style:{ display:'flex', gap:6, marginBottom:14 } },
            React.createElement('span', { style:{ fontSize:11, color:'#5A6456' } }, 'Previous:'),
            ...bloom.prevVersions.map(v => React.createElement('span', { key:v, style:{ fontSize:11, color:'rgba(255,179,0,0.5)', background:'rgba(255,179,0,0.06)', borderRadius:100, padding:'1px 8px', border:'1px solid rgba(255,179,0,0.15)' } }, v))
          ),

          React.createElement('div', { style:{ height:1, background:'linear-gradient(to right,rgba(255,179,0,0.3),transparent)', marginBottom:14 } }),

          // Summary
          React.createElement('p', { style:{ fontSize:13, lineHeight:1.7, color:'#A0A890', marginBottom:20 } }, bloom.summary),

          // Dimensions bar
          React.createElement('div', { style:{ marginBottom:22 } },
            React.createElement('p', { style:{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4CAF50', marginBottom:10 } }, 'Dimensions explored'),
            React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6 } },
              SEED_DIMS.slice(0,4).map(d => {
                const cnt = bloom.dims[d.id]||0;
                const max = Math.max(...Object.values(bloom.dims), 1);
                return React.createElement('div', { key:d.id, style:{ display:'flex', alignItems:'center', gap:8 } },
                  React.createElement('span', { style:{ fontSize:12, width:16 } }, d.emoji),
                  React.createElement('span', { style:{ fontSize:11, color:'#6A7A68', width:76, flexShrink:0 } }, d.label),
                  React.createElement('div', { style:{ flex:1, height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' } },
                    React.createElement('div', { style:{ height:'100%', width:max>0?(cnt/max*100)+'%':'0%', background:d.color, borderRadius:2, opacity:cnt>0?0.85:0 } })
                  ),
                  React.createElement('span', { style:{ fontSize:10, color:'#4A5848', width:12, textAlign:'right' } }, cnt||'')
                );
              })
            )
          ),

          // Contributors + Endorsements
          React.createElement('div', null,
            React.createElement('p', { style:{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4CAF50', marginBottom:12 } }, 'Knowledge Lineage · Endorse Contributors'),
            bloom.contributors.map(c => {
              const key = bloom.id+'-'+c.name;
              const endorsed = myEndorsements[key];
              const count = endorsements[bloom.id]?.[c.name] || c.endorsements;
              return React.createElement('div', { key:c.name, style:{ display:'flex', gap:10, alignItems:'center', padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' } },
                React.createElement('span', { style:{ fontSize:22, flexShrink:0 } }, c.emoji),
                React.createElement('div', { style:{ flex:1, minWidth:0 } },
                  React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
                    React.createElement('button', {
                      onClick:()=>goProfile&&goProfile(c.name),
                      style:{ background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#D8D4CC', textDecoration:'none' }
                    }, c.name),
                    React.createElement('span', { style:{ fontSize:10, color:'rgba(255,213,79,0.6)', background:'rgba(255,213,79,0.06)', borderRadius:100, padding:'1px 7px', border:'1px solid rgba(255,213,79,0.15)' } }, count+' ✦')
                  ),
                  React.createElement('span', { style:{ fontSize:11, color:'#4A5848' } }, c.role)
                ),
                React.createElement('button', {
                  onClick:()=>endorse(bloom.id, c.name),
                  disabled:endorsed,
                  style:{
                    padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:600, cursor:endorsed?'default':'pointer',
                    background:endorsed?'rgba(255,213,79,0.12)':'rgba(255,255,255,0.05)',
                    border:'1px solid '+(endorsed?'rgba(255,213,79,0.35)':'rgba(255,255,255,0.1)'),
                    color:endorsed?'#FFD54F':'#7A8A78',
                    fontFamily:"'Inter',sans-serif", transition:'all 0.2s', flexShrink:0,
                  }
                }, endorsed?'✦ Endorsed':'Endorse')
              );
            }),

            // Extra contributors added dynamically
            (extraContribs[bloom.id]||[]).map((c,i) => {
              const key2 = bloom.id+'-extra-'+i;
              const endorsed2 = myEndorsements[key2];
              return React.createElement('div', { key:'extra'+i, style:{ display:'flex', gap:10, alignItems:'center', padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' } },
                React.createElement('div', { style:{ width:30, height:30, borderRadius:'50%', background:'rgba(76,175,80,0.2)', border:'1px solid rgba(76,175,80,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#66BB6A', flexShrink:0 } }, c.name[0].toUpperCase()),
                React.createElement('div', { style:{ flex:1 } },
                  React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6, marginBottom:2 } },
                    React.createElement('span', { style:{ fontSize:13, fontWeight:600, color:'#D8D4CC' } }, c.name),
                    React.createElement('span', { style:{ fontSize:10, color:'#4CAF50', background:'rgba(76,175,80,0.1)', borderRadius:100, padding:'1px 6px' } }, 'Added')
                  ),
                  React.createElement('span', { style:{ fontSize:11, color:'#4A5848' } }, c.role+' · '+c.email)
                ),
                React.createElement('button', {
                  onClick:()=>endorse(bloom.id, c.name, key2),
                  disabled:endorsed2,
                  style:{ padding:'5px 12px', borderRadius:100, fontSize:11.5, fontWeight:600, cursor:endorsed2?'default':'pointer', background:endorsed2?'rgba(255,213,79,0.12)':'rgba(255,255,255,0.05)', border:'1px solid '+(endorsed2?'rgba(255,213,79,0.35)':'rgba(255,255,255,0.1)'), color:endorsed2?'#FFD54F':'#7A8A78', fontFamily:"'Inter',sans-serif", transition:'all 0.2s' }
                }, endorsed2?'✦':'Endorse')
              );
            }),

            // Add contributor form
            React.createElement('div', { style:{ marginTop:14, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' } },
              addingTo === bloom.id
                ? React.createElement('div', { style:{ background:'rgba(76,175,80,0.06)', border:'1px solid rgba(76,175,80,0.2)', borderRadius:12, padding:'14px' } },
                    React.createElement('p', { style:{ fontSize:11, fontWeight:600, color:'#4CAF50', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 } }, 'Add a contributor'),
                    React.createElement('input', {
                      autoFocus:true, value:addEmail, onChange:e=>setAddEmail(e.target.value),
                      placeholder:'Email or name (e.g. rahul@company.com)',
                      onKeyDown:e=>{ if(e.key==='Enter') addContributor(bloom.id); },
                      style:{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(76,175,80,0.25)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#E8E4DC', fontFamily:"'Inter',sans-serif", outline:'none', marginBottom:8, boxSizing:'border-box' }
                    }),
                    React.createElement('input', {
                      value:addRole, onChange:e=>setAddRole(e.target.value),
                      placeholder:'Their role (e.g. Added production examples)',
                      onKeyDown:e=>{ if(e.key==='Enter') addContributor(bloom.id); },
                      style:{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(76,175,80,0.25)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#E8E4DC', fontFamily:"'Inter',sans-serif", outline:'none', marginBottom:10, boxSizing:'border-box' }
                    }),
                    React.createElement('div', { style:{ display:'flex', gap:8 } },
                      React.createElement('button', { onClick:()=>setAddingTo(null), style:{ flex:1, padding:'8px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#7A8A78', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13 } }, 'Cancel'),
                      React.createElement('button', {
                        onClick:()=>addContributor(bloom.id),
                        disabled:!addEmail.trim(),
                        style:{ flex:2, padding:'8px', borderRadius:8, background:addEmail.trim()?'#4CAF50':'rgba(255,255,255,0.06)', color:addEmail.trim()?'#060A06':'rgba(255,255,255,0.2)', border:'none', cursor:addEmail.trim()?'pointer':'default', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600 }
                      }, '+ Add to Lineage')
                    )
                  )
                : React.createElement('button', {
                    onClick:()=>setAddingTo(bloom.id),
                    style:{ width:'100%', padding:'10px', borderRadius:10, background:'rgba(76,175,80,0.05)', border:'1.5px dashed rgba(76,175,80,0.25)', color:'rgba(76,175,80,0.7)', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:500, transition:'all 0.2s' }
                  }, '+ Add a contributor to this Bloom')
            )
          ),

          // View conversation button at bottom
          React.createElement('div', { style:{ padding:'14px 18px', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 } },
            React.createElement('button', {
              onClick:()=>go&&go('seed'),
              style:{ width:'100%', padding:'12px', borderRadius:10, background:'rgba(76,175,80,0.1)', border:'1px solid rgba(76,175,80,0.3)', color:'#66BB6A', cursor:'pointer', fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:600, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }
            }, '💬 View full conversation →')
          )
        )
      )
    )
  );
}

function SidePanel({ show, onClose, onGo }) {
  const justOpened = useRef(false);
  useEffect(() => {
    if (show) {
      justOpened.current = true;
      const t = setTimeout(() => { justOpened.current = false; }, 200);
      return () => clearTimeout(t);
    }
  }, [show]);

  const handleBackdropClick = () => {
    if (!justOpened.current) onClose();
  };
  return (
    <>
      <div onClick={handleBackdropClick} style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,0.38)",
        backdropFilter:"blur(3px)",WebkitBackdropFilter:"blur(3px)",
        zIndex:200,opacity:show?1:0,pointerEvents:show?"auto":"none",
        transition:"opacity 0.3s ease",
      }}/>
      <div style={{
        position:"fixed",top:0,left:0,bottom:0,width:292,
        background:"rgba(7,14,7,0.96)",
        backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",
        borderRight:"1px solid rgba(76,175,80,0.18)",
        boxShadow:"4px 0 32px rgba(0,0,0,0.18)",
        zIndex:201,
        transform:show?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.36s cubic-bezier(0.22,1,0.36,1)",
        display:"flex",flexDirection:"column",
        overflowY:"auto",
      }}>
        {/* Header */}
        <div style={{padding:"52px 20px 16px",borderBottom:"1px solid rgba(46,125,50,0.12)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:22,fontWeight:300,color:C.ink}}>🌱 Kubernetes</span>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.inkSoft,lineHeight:1}}>✕</button>
          </div>
          <p style={{fontSize:12,color:C.inkSoft}}>26 participants · 4 seeds · 2 blooms</p>
        </div>

        {/* Seeds */}
        <div style={{padding:"16px 12px 4px"}}>
          <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.13em",textTransform:"uppercase",color:C.accent,marginBottom:8,paddingLeft:8}}>Seeds</p>
          {GARDEN_SEEDS.map(s=>(
            <button key={s.id} onClick={()=>{onGo(s.bloomed?"bloomDetail":"seed");onClose();}} style={{
              display:"flex",gap:9,alignItems:"flex-start",width:"100%",textAlign:"left",
              padding:"9px 10px",borderRadius:10,background:"none",border:"none",cursor:"pointer",
              marginBottom:2,transition:"all 0.15s",fontFamily:"'Inter',sans-serif",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(46,125,50,0.09)"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <span style={{fontSize:15,flexShrink:0,marginTop:1}}>{s.bloomed?"🌸":"🌱"}</span>
              <div>
                <p style={{fontSize:13,color:C.ink,lineHeight:1.4,marginBottom:2}}>{s.title}</p>
                <p style={{fontSize:11,color:C.inkSoft}}>{s.replies} replies · {s.age}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Sacred Tree */}
        <div style={{padding:"8px 12px 16px",borderBottom:"1px solid rgba(46,125,50,0.12)"}}>
          <button onClick={()=>{onGo("tree");onClose();}} style={{
            display:"flex",gap:10,alignItems:"center",width:"100%",
            padding:"11px 10px",borderRadius:10,background:"none",border:"none",cursor:"pointer",
            fontFamily:"'Inter',sans-serif",transition:"all 0.15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,143,0,0.08)"}
            onMouseLeave={e=>e.currentTarget.style.background="none"}>
            <span style={{fontSize:20}}>🌳</span>
            <div style={{flex:1}}>
              <p style={{fontSize:14,fontWeight:500,color:C.ink}}>Sacred Tree</p>
              <p style={{fontSize:11,color:C.inkSoft}}>7 leaves · collective memory</p>
            </div>
            <span style={{fontSize:13,color:C.accentBright}}>→</span>
          </button>
        </div>

        {/* Members */}
        <div style={{padding:"8px 12px 8px",borderBottom:"1px solid rgba(46,125,50,0.12)"}}>
          <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.13em",textTransform:"uppercase",color:C.accent,marginBottom:8,paddingLeft:8}}>Members</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingLeft:8}}>
            {['Siva','Rahul','Priya','Vivek','Meera','Akash'].map((name,i)=>{
              const cols=['#8B7355','#2d5a3d','#6B4C8A','#2a6fdb','#d4a574','#1F8A5B'];
              return React.createElement('button',{key:name,onClick:()=>{onGo('profile');onClose();},title:name,
                style:{width:32,height:32,borderRadius:'50%',background:cols[i],border:'1.5px solid rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Inter',sans-serif",transition:'all 0.15s'}
              },name[0]);
            })}
          </div>
        </div>
        {/* Other Gardens */}
        <div style={{padding:"16px 12px",flex:1}}>
          <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.13em",textTransform:"uppercase",color:C.accent,marginBottom:8,paddingLeft:8}}>Other Gardens</p>
          {["React","System Design","Leadership","LLMs"].map(g=>(
            <button key={g} onClick={()=>{onGo("gardenHome");onClose();}} style={{
              display:"flex",gap:9,alignItems:"center",width:"100%",
              padding:"9px 10px",borderRadius:10,background:"none",border:"none",cursor:"pointer",
              marginBottom:2,transition:"all 0.15s",fontFamily:"'Inter',sans-serif",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(46,125,50,0.09)"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <span style={{fontSize:15}}>🌱</span>
              <span style={{fontSize:13,color:C.inkMid}}>{g}</span>
            </button>
          ))}
        </div>

        {/* Plant new seed */}
        <div style={{padding:"12px 20px 32px",borderTop:"1px solid rgba(46,125,50,0.12)"}}>
          <button className="btn btn-grow" style={{width:"100%",justifyContent:"center",fontSize:13}} onClick={()=>{onGo("garden");onClose();}}>
            🌱 Plant a new Seed
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════ */
function RhyzaV3() {
  const [screen, setScreen] = useState("intent");
  const [history, setHistory] = useState(["intent"]);
  const [showPanel, setShowPanel] = useState(false);
  const [profileName, setProfileName] = useState('Rahul');
  const goProfile = (name) => { setProfileName(name); go('profile'); };

  const go = s => { setScreen(s); setHistory(h=>[...h,s]); };
  const back = () => {
    if(history.length>1){
      const prev=history[history.length-2];
      setHistory(h=>h.slice(0,-1));
      setScreen(prev);
    }
  };

  const gardenScreens = ["gardenHome","garden","invite","seed","bloomproposal","bloom","tree","profile"];
  useEffect(() => {
    if (gardenScreens.includes(screen)) {
      window.__rhyzaOpenPanel = () => setShowPanel(true);
    } else {
      delete window.__rhyzaOpenPanel;
    }
    return () => { delete window.__rhyzaOpenPanel; };
  }, [screen]);

  const p={go,back,goProfile};
  return (
    <>
      <style>{CSS}</style>
      <SidePanel show={showPanel} onClose={()=>setShowPanel(false)} onGo={go}/>
      {screen==="intent"       && <S1_Intent {...p}/>}
      {screen==="search"       && <S2_Search {...p}/>}
      {screen==="nogarden"     && <S3_NoGarden {...p}/>}
      {screen==="gardenHome"     && <S4b_GardenHome {...p}/>}
      {screen==="garden"       && <S4_Garden {...p}/>}
      {screen==="invite"       && <S5_Invite {...p}/>}
      {screen==="seed"         && <S6_Seed {...p}/>}
      {screen==="bloomproposal"&& <S7_BloomProposal {...p}/>}
      {screen==="bloom"        && <S8_Bloom {...p}/>}
      {screen==="tree"         && <S9_Tree {...p}/>}
      {screen==="profile"       && <S_Profile {...p} name={profileName}/>}
    </>
  );
}

module.exports = { RhyzaV3 };
/* ══════════════════════════════════════════════════════
   NATURE SOUNDS
══════════════════════════════════════════════════════ */
function playNatureSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'drop') {
      // Rain droplet — brief filtered noise click
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/data.length, 3);
      }
      const src2 = ctx.createBufferSource();
      src2.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      src2.connect(f); f.connect(g); g.connect(ctx.destination);
      src2.start();
    } else if (type === 'wind') {
      // Wind chime — two gentle sine waves
      [523, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.1 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 1.2);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 1.2);
      });
    } else if (type === 'bloom') {
      // Bloom — magical high-pitched pentatonic cascade with shimmer
      // Layer 1: bright high pentatonic cascade
      [784, 988, 1175, 1568, 1976, 2349, 3136].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i*0.1);
        osc.frequency.exponentialRampToValueAtTime(freq*1.02, ctx.currentTime + i*0.1 + 0.3);
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.1 - i*0.01, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.8 - i*0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + 1.8);
      });
      // Layer 2: lower harmonics for warmth
      [392, 494, 587, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.15 + 0.05;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + 2.2);
      });
      // Layer 3: shimmer (high freq noise burst)
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length,2);
      const shimmer = ctx.createBufferSource();
      shimmer.buffer = buf;
      const sf = ctx.createBiquadFilter(); sf.type='highpass'; sf.frequency.value=6000;
      const sg = ctx.createGain(); sg.gain.value=0.08;
      shimmer.connect(sf); sf.connect(sg); sg.connect(ctx.destination);
      shimmer.start(ctx.currentTime + 0.6);
    } else if (type === 'chirp') {
      // Bird chirp — frequency sweep
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.09, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.22);
    }
  } catch(e) {}
}


