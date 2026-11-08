/**
 * Tier 6 (Civilization) renderers, all top-down and facing +x: people, cars, trucks, police cars,
 * houses, tower rooftops, airliners and tanks. Headlights / window glows are additive sprites that
 * grow with tier progress (the city turns its lights on as you grow).
 */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import { defineRenderers } from '../define';
import { TAU, bakeU, glowSprite, us } from './t04_kit';

const shadow = (w: number, h: number, ox: number, oy: number, a = 0.3): Sprite => {
  const s = new Sprite(Tex.glow());
  s.anchor.set(0.5);
  s.width = w; s.height = h;
  s.tint = 0x000000;
  s.alpha = a;
  s.position.set(ox, oy);
  return s;
};

const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
};

const metal = (c: CanvasRenderingContext2D, y0: number, y1: number, dark = 0.62) => {
  const g = c.createLinearGradient(0, y0, 0, y1);
  const d = Math.round(dark * 255);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.5, `rgb(${Math.round((255 + d) / 2)},${Math.round((255 + d) / 2)},${Math.round((255 + d) / 2)})`);
  g.addColorStop(1, `rgb(${d},${d},${d})`);
  return g;
};

// ---------------------------------------------------------------- person
const shoulderTex = () =>
  bakeU('t06:person:body', 1.2, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-0.05, 0, 0.5, 0.95, 0, 0, TAU); c.fill();
  }, 128);
const headTex = () =>
  bakeU('t06:person:head', 1.2, (c) => {
    const g = c.createRadialGradient(0.1, -0.05, 0, 0.12, 0, 0.6);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#a8a8a8');
    c.fillStyle = g;
    c.beginPath(); c.arc(0.12, 0, 0.55, 0, TAU); c.fill();
  }, 128);
const person = {
  id: 't06_person',
  create() {
    const v = new Container();
    v.addChild(shadow(3.2, 3.2, 0.2, 0.3, 0.35));
    v.addChild(us(shoulderTex(), 1.2));
    v.addChild(us(headTex(), 1.2));
    v.addChild(glowSprite(3.4, 0.35));
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color;
    (v.children[2] as Sprite).tint = e.color2;
    (v.children[3] as Sprite).tint = e.color;
  },
  update(v: Container, e: any) {
    const sp = Math.hypot(e.vx, e.vy) / e.radius;
    v.children[1].skew.y = Math.sin(e.age * (8 + sp * 3) + e.uid) * 0.18 * Math.min(1, sp);
    v.children[3].alpha = 0.18 + 0.25 * (0.5 + 0.5 * Math.sin(e.age * 2 + e.uid));
  },
};

// ---------------------------------------------------------------- cars
const carBody = () =>
  bakeU('t06:car:body', 1.7, (c) => {
    rr(c, -1.25, -0.66, 2.5, 1.32, 0.42);
    c.fillStyle = metal(c, -0.66, 0.66, 0.6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    rr(c, 0.45, -0.5, 0.65, 1.0, 0.25); c.fill();                 // hood sheen
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(0.38, -0.58); c.lineTo(0.38, 0.58); c.moveTo(-0.9, -0.55); c.lineTo(-0.9, 0.55); c.stroke();
  }, 256);
const carGlass = () =>
  bakeU('t06:car:glass', 1.7, (c) => {
    c.fillStyle = 'rgba(18,28,48,0.92)';
    c.beginPath(); c.moveTo(0.42, -0.52); c.lineTo(0.12, -0.6); c.lineTo(0.12, 0.6); c.lineTo(0.42, 0.52); c.closePath(); c.fill();   // windshield
    c.beginPath(); c.moveTo(-0.6, -0.5); c.lineTo(-0.82, -0.56); c.lineTo(-0.82, 0.56); c.lineTo(-0.6, 0.5); c.closePath(); c.fill();   // rear window
    rr(c, -0.6, -0.6, 0.72, 0.2, 0.05); c.fill(); rr(c, -0.6, 0.4, 0.72, 0.2, 0.05); c.fill();                                      // side windows
    c.fillStyle = 'rgba(160,200,255,0.25)';
    c.beginPath(); c.moveTo(0.36, -0.46); c.lineTo(0.2, -0.5); c.lineTo(0.2, -0.1); c.lineTo(0.34, -0.1); c.closePath(); c.fill();
  }, 256);
const carRoof = () =>
  bakeU('t06:car:roof', 1.7, (c) => {
    rr(c, -0.62, -0.48, 0.76, 0.96, 0.18);
    c.fillStyle = metal(c, -0.48, 0.48, 0.75); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.025; c.stroke();
  }, 256);
const beam = () =>
  bakeU('t06:car:beam', 3.4, (c) => {
    const g = c.createLinearGradient(1.1, 0, 3.3, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(1.1, -0.28); c.lineTo(3.3, -0.95); c.lineTo(3.3, 0.95); c.lineTo(1.1, 0.28); c.closePath(); c.fill();
  }, 256);

const lights = (v: Container, front: number, back: number, half: number) => {
  v.addChild(us(beam(), 3.4, { add: true, alpha: 0.0, x: front - 1.2, y: 0 }));   // beam
  v.addChild(glowSprite(1.3, 0.9, front, -half));
  v.addChild(glowSprite(1.3, 0.9, front, half));
  v.addChild(glowSprite(0.8, 0.9, back, -half));
  v.addChild(glowSprite(0.8, 0.9, back, half));
};

const car = {
  id: 't06_car',
  create() {
    const v = new Container();
    v.addChild(shadow(3.3, 2.1, 0.12, 0.22, 0.4));            // 0
    v.addChild(us(carBody(), 1.7));                           // 1
    v.addChild(us(carGlass(), 1.7));                          // 2
    v.addChild(us(carRoof(), 1.7));                           // 3
    lights(v, 1.2, -1.2, 0.42);                               // 4 beam, 5,6 head, 7,8 tail
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = e.color;
    for (const i of [4, 5, 6]) (v.children[i] as Sprite).tint = 0xfff2c0;
    for (const i of [7, 8]) (v.children[i] as Sprite).tint = 0xff3a3a;
  },
  update(v: Container, e: any, _p: any, ctx: any) {
    const night = 0.35 + 0.65 * ctx.progress;
    (v.children[4] as Sprite).alpha = 0.55 * night;
    (v.children[5] as Sprite).alpha = (v.children[6] as Sprite).alpha = 0.5 + 0.5 * night;
    (v.children[7] as Sprite).alpha = (v.children[8] as Sprite).alpha = 0.7;
  },
};

const truckCab = () =>
  bakeU('t06:truck:cab', 2.3, (c) => {
    rr(c, 0.7, -0.62, 1.1, 1.24, 0.28);
    c.fillStyle = metal(c, -0.62, 0.62, 0.62); c.fill();
    c.fillStyle = 'rgba(18,28,48,0.92)';
    c.beginPath(); c.moveTo(1.55, -0.5); c.lineTo(1.28, -0.56); c.lineTo(1.28, 0.56); c.lineTo(1.55, 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)'; rr(c, 0.75, -0.55, 0.45, 1.1, 0.1); c.fill();
  }, 256);
const truckBox = () =>
  bakeU('t06:truck:box', 2.3, (c) => {
    rr(c, -1.95, -0.7, 2.55, 1.4, 0.1);
    const g = c.createLinearGradient(0, -0.7, 0, 0.7);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#a8a8a8');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.04;
    for (let x = -1.7; x < 0.6; x += 0.28) { c.beginPath(); c.moveTo(x, -0.66); c.lineTo(x, 0.66); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-1.95, -0.1, 2.55, 0.2);
  }, 256);
const truck = {
  id: 't06_truck',
  create() {
    const v = new Container();
    v.addChild(shadow(4.6, 2.2, 0.0, 0.25, 0.4));
    v.addChild(us(truckBox(), 2.3));       // 1
    v.addChild(us(truckCab(), 2.3));       // 2
    lights(v, 1.75, -1.95, 0.45);          // 3 beam, 4,5 head, 6,7 tail
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color2;
    (v.children[2] as Sprite).tint = e.color;
    for (const i of [3, 4, 5]) (v.children[i] as Sprite).tint = 0xfff2c0;
    for (const i of [6, 7]) (v.children[i] as Sprite).tint = 0xff3a3a;
  },
  update(v: Container, e: any, _p: any, ctx: any) {
    const night = 0.35 + 0.65 * ctx.progress;
    (v.children[3] as Sprite).alpha = 0.5 * night;
    (v.children[4] as Sprite).alpha = (v.children[5] as Sprite).alpha = 0.5 + 0.5 * night;
    (v.children[6] as Sprite).alpha = (v.children[7] as Sprite).alpha = 0.7;
  },
};

// ---------------------------------------------------------------- police
const copPanel = () =>
  bakeU('t06:cop:panel', 1.7, (c) => {
    c.fillStyle = '#fff';
    rr(c, -0.95, -0.66, 1.0, 1.32, 0.1); c.fill();
    c.fillStyle = 'rgba(20,30,70,0.9)';
    rr(c, -0.95, -0.14, 1.0, 0.28, 0.05); c.fill();
  }, 256);
const copBar = () =>
  bakeU('t06:cop:bar', 1.7, (c) => {
    c.fillStyle = '#fff';
    rr(c, -0.2, -0.52, 0.32, 1.04, 0.06); c.fill();
  }, 128);
const police = {
  id: 't06_police',
  create() {
    const v = new Container();
    v.addChild(glowSprite(7, 0.0));                           // 0 siren wash
    v.addChild(shadow(3.3, 2.1, 0.12, 0.22, 0.4));            // 1
    v.addChild(us(carBody(), 1.7));                           // 2
    v.addChild(us(copPanel(), 1.7, { alpha: 0.95 }));         // 3
    v.addChild(us(carGlass(), 1.7));                          // 4
    v.addChild(us(carRoof(), 1.7));                           // 5
    v.addChild(us(copBar(), 1.7));                            // 6
    v.addChild(glowSprite(2.6, 0.9, -0.05, -0.34));           // 7 red
    v.addChild(glowSprite(2.6, 0.9, -0.05, 0.34));            // 8 blue
    v.addChild(glowSprite(1.3, 0.9, 1.2, -0.42));             // 9
    v.addChild(glowSprite(1.3, 0.9, 1.2, 0.42));              // 10
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[2] as Sprite).tint = e.color;
    (v.children[5] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = 0xffffff;
    (v.children[6] as Sprite).tint = 0xdde6ff;
    (v.children[7] as Sprite).tint = 0xff2a3a;
    (v.children[8] as Sprite).tint = 0x2a6aff;
    (v.children[9] as Sprite).tint = (v.children[10] as Sprite).tint = 0xfff2c0;
  },
  update(v: Container, e: any) {
    const ph = Math.sin(e.age * 11 + e.uid);
    const a = ph > 0 ? 1 : 0.1, b = ph > 0 ? 0.1 : 1;
    (v.children[7] as Sprite).alpha = a;
    (v.children[8] as Sprite).alpha = b;
    const wash = v.children[0] as Sprite;
    wash.tint = ph > 0 ? 0xff2a3a : 0x2a6aff;
    wash.alpha = 0.35;
  },
};

// ---------------------------------------------------------------- house
const houseLawn = () =>
  bakeU('t06:house:lawn', 2.2, (c) => {
    rr(c, -1.9, -1.7, 3.8, 3.4, 0.35);
    c.fillStyle = '#4a7a3a'; c.fill();
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 14; i++) c.fillRect(-1.9 + i * 0.28, -1.7, 0.14, 3.4);
    c.fillStyle = '#6a6a72'; rr(c, 0.6, 1.0, 0.5, 0.7, 0.05); c.fill();       // driveway
    c.fillStyle = '#2f5a2a';
    for (const [x, y, r] of [[-1.55, -1.3, 0.28], [1.5, -1.35, 0.32], [-1.6, 1.35, 0.25]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  }, 384);
const houseRoof = () =>
  bakeU('t06:house:roof', 2.2, (c) => {
    // two roof planes split along the ridge (y=0)
    c.fillStyle = '#fff';
    rr(c, -1.25, -0.95, 2.5, 0.95, 0.06); c.fill();
    c.fillStyle = '#b4b4b4';
    rr(c, -1.25, 0, 2.5, 0.95, 0.06); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.04;
    for (let y = -0.8; y < 0.9; y += 0.2) { c.beginPath(); c.moveTo(-1.22, y); c.lineTo(1.22, y); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.06;
    c.beginPath(); c.moveTo(-1.25, 0); c.lineTo(1.25, 0); c.stroke();
    c.fillStyle = '#5a4a44'; c.fillRect(0.55, -0.7, 0.28, 0.3);   // chimney
  }, 384);
const house = {
  id: 't06_house',
  create() {
    const v = new Container();
    v.addChild(us(houseLawn(), 2.2, { alpha: 0.9 }));              // 0
    v.addChild(shadow(3.0, 2.2, 0.35, 0.5, 0.4));                  // 1
    v.addChild(us(houseRoof(), 2.2));                              // 2
    v.addChild(glowSprite(4.4, 0.0));                              // 3 window glow
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[2] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = 0xffc060;
    v.rotation = 0;
  },
  update(v: Container, e: any, _p: any, ctx: any) {
    // Houses stay square to the street.
    v.rotation = Math.round(e.rotation / (Math.PI / 2)) * (Math.PI / 2);
    const lit = Math.min(1, ctx.progress * 2.4 + 0.05) * (0.75 + 0.25 * Math.sin(e.age * 0.7 + e.uid));
    (v.children[3] as Sprite).alpha = 0.12 + 0.5 * lit * (e.uid % 5 === 0 ? 0.4 : 1);
  },
};

// ---------------------------------------------------------------- tower rooftop
const roofTex = () =>
  bakeU('t06:tower:roof', 2.0, (c) => {
    c.fillStyle = metal(c, -1.5, 1.5, 0.55);
    rr(c, -1.5, -1.5, 3, 3, 0.1); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.07; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.18)';
    rr(c, -1.15, -1.15, 2.3, 2.3, 0.08); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    rr(c, -1.05, -1.05, 2.1, 2.1, 0.06); c.fill();
    // setbacks + machinery
    c.fillStyle = 'rgba(255,255,255,0.7)'; rr(c, -0.7, -0.7, 1.0, 0.8, 0.05); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)'; rr(c, 0.3, 0.2, 0.7, 0.7, 0.05); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.05;
    c.beginPath(); c.arc(0.65, 0.55, 0.22, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(0.5, 0.55); c.lineTo(0.8, 0.55); c.moveTo(0.65, 0.4); c.lineTo(0.65, 0.7); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, -0.95, 0.35, 0.6, 0.5, 0.05); c.fill();
  }, 384);
const tower = {
  id: 't06_building',
  create() {
    const v = new Container();
    v.addChild(glowSprite(5.8, 0.0));                              // 0 window glow
    v.addChild(shadow(4.0, 3.4, 0.9, 1.0, 0.5));                   // 1
    v.addChild(us(roofTex(), 2.0));                                // 2
    for (const [x, y] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) v.addChild(glowSprite(0.8, 0.9, x, y)); // 3..6
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[2] as Sprite).tint = e.color;
    (v.children[0] as Sprite).tint = e.color2;
    for (let i = 3; i <= 6; i++) (v.children[i] as Sprite).tint = 0xff3a3a;
  },
  update(v: Container, e: any, _p: any, ctx: any) {
    v.rotation = Math.round(e.rotation / (Math.PI / 2)) * (Math.PI / 2);
    const lit = Math.min(1, ctx.progress * 2.2 + 0.1);
    (v.children[0] as Sprite).alpha = 0.1 + 0.5 * lit * (0.85 + 0.15 * Math.sin(e.age * 0.9 + e.uid));
    const b = Math.max(0, Math.sin(e.age * 2.2 + e.uid));
    for (let i = 3; i <= 6; i++) (v.children[i] as Sprite).alpha = 0.15 + 0.85 * ((i + (e.uid | 0)) % 2 ? b : 1 - b);
  },
};

// ---------------------------------------------------------------- airliner
const planeTex = () =>
  bakeU('t06:plane', 2.4, (c) => {
    const g = c.createLinearGradient(0, -0.3, 0, 0.3);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#a8a8a8');
    // wings
    c.fillStyle = '#d8d8d8';
    c.beginPath(); c.moveTo(0.5, -0.2); c.lineTo(-0.6, -2.0); c.lineTo(-1.0, -2.0); c.lineTo(-0.5, -0.2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.5, 0.2); c.lineTo(-0.6, 2.0); c.lineTo(-1.0, 2.0); c.lineTo(-0.5, 0.2); c.closePath(); c.fill();
    // tailplanes
    c.beginPath(); c.moveTo(-1.6, -0.12); c.lineTo(-2.1, -0.85); c.lineTo(-2.3, -0.85); c.lineTo(-2.05, -0.12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-1.6, 0.12); c.lineTo(-2.1, 0.85); c.lineTo(-2.3, 0.85); c.lineTo(-2.05, 0.12); c.closePath(); c.fill();
    // engines
    c.fillStyle = '#9a9a9a';
    for (const y of [-1.0, 1.0]) { c.beginPath(); c.ellipse(-0.05, y, 0.42, 0.14, 0, 0, TAU); c.fill(); c.fillStyle = '#555'; c.beginPath(); c.arc(0.3, y, 0.08, 0, TAU); c.fill(); c.fillStyle = '#9a9a9a'; }
    // fuselage
    c.fillStyle = g;
    c.beginPath(); c.moveTo(2.3, 0); c.quadraticCurveTo(2.25, -0.3, 1.6, -0.3); c.lineTo(-1.6, -0.2); c.quadraticCurveTo(-2.4, -0.1, -2.5, 0); c.quadraticCurveTo(-2.4, 0.1, -1.6, 0.2); c.lineTo(1.6, 0.3); c.quadraticCurveTo(2.25, 0.3, 2.3, 0); c.fill();
    c.fillStyle = 'rgba(20,30,50,0.8)';
    c.beginPath(); c.moveTo(1.95, 0); c.lineTo(1.65, -0.2); c.lineTo(1.45, -0.18); c.lineTo(1.45, 0.18); c.lineTo(1.65, 0.2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,50,90,0.6)';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(1.2 - i * 0.2, -0.27, 0.025, 0, TAU); c.arc(1.2 - i * 0.2, 0.27, 0.025, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(1.3, 0); c.lineTo(-2.2, 0); c.stroke();
  }, 512);
const plane = {
  id: 't06_plane',
  create() {
    const v = new Container();
    v.addChild(shadow(6.4, 4.4, 0.9, 1.4, 0.3));                   // 0
    v.addChild(us(planeTex(), 2.4));                               // 1
    v.addChild(glowSprite(0.7, 1, -0.8, -1.95));                   // 2 red
    v.addChild(glowSprite(0.7, 1, -0.8, 1.95));                    // 3 green
    v.addChild(glowSprite(0.9, 1, -2.4, 0));                       // 4 strobe
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color;
    (v.children[2] as Sprite).tint = 0xff2a2a;
    (v.children[3] as Sprite).tint = 0x2aff6a;
  },
  update(v: Container, e: any) {
    const t = e.age + e.uid;
    (v.children[4] as Sprite).alpha = Math.sin(t * 5) > 0.85 ? 1 : 0.05;
    (v.children[2] as Sprite).alpha = (v.children[3] as Sprite).alpha = 0.6 + 0.4 * Math.sin(t * 3);
  },
};

// ---------------------------------------------------------------- tank
const tankHull = () =>
  bakeU('t06:tank:hull', 2.0, (c) => {
    c.fillStyle = '#2a2a2a';
    rr(c, -1.45, -1.0, 2.9, 0.48, 0.14); c.fill();
    rr(c, -1.45, 0.52, 2.9, 0.48, 0.14); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.04;
    for (let x = -1.35; x < 1.4; x += 0.2) { c.beginPath(); c.moveTo(x, -0.98); c.lineTo(x, -0.54); c.moveTo(x, 0.54); c.lineTo(x, 0.98); c.stroke(); }
    c.fillStyle = metal(c, -0.62, 0.62, 0.55);
    c.beginPath(); c.moveTo(1.4, -0.35); c.lineTo(1.05, -0.62); c.lineTo(-1.35, -0.62); c.lineTo(-1.45, -0.45); c.lineTo(-1.45, 0.45); c.lineTo(-1.35, 0.62); c.lineTo(1.05, 0.62); c.lineTo(1.4, 0.35); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) rr(c, -1.25 + i * 0.22, -0.4, 0.14, 0.8, 0.03), c.fill();
  }, 384);
const tankTurret = () =>
  bakeU('t06:tank:turret', 2.4, (c) => {
    // origin = turret pivot; barrel extends +x
    c.fillStyle = '#fff';
    rr(c, 0.2, -0.09, 1.9, 0.18, 0.04); c.fill();
    rr(c, 1.9, -0.14, 0.34, 0.28, 0.05); c.fill();
    const g = c.createRadialGradient(-0.1, -0.1, 0.05, 0, 0, 0.7);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#8a8a8a');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0.6, 0); c.lineTo(0.35, -0.5); c.lineTo(-0.45, -0.55); c.lineTo(-0.7, -0.2); c.lineTo(-0.7, 0.2); c.lineTo(-0.45, 0.55); c.lineTo(0.35, 0.5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.04; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(-0.1, 0.15, 0.17, 0, TAU); c.fill();
  }, 512);
const tank = {
  id: 't06_tank',
  create() {
    const v = new Container();
    v.addChild(shadow(4.2, 3.0, 0.2, 0.3, 0.4));                   // 0
    v.addChild(us(tankHull(), 2.0));                               // 1
    const turret = new Container();                                // 2
    turret.addChild(us(tankTurret(), 2.4));
    turret.addChild(glowSprite(1.8, 0.0, 2.3, 0));
    v.addChild(turret);
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color;
    const t = v.children[2] as Container;
    (t.children[0] as Sprite).tint = e.color;
    (t.children[1] as Sprite).tint = 0xffc060;
  },
  update(v: Container, e: any, _p: any, ctx: any) {
    const pl = ctx.player;
    const t = v.children[2] as Container;
    if (pl.alive) {
      const want = Math.atan2(pl.y - e.y, pl.x - e.x) - e.rotation;
      const cur = t.rotation;
      const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      t.rotation = cur + d * 0.08;
    }
    const f = t.children[1] as Sprite;
    f.alpha = Math.max(0, f.alpha - 0.06);
    if (Math.sin(e.age * 1.6 + e.uid) > 0.992) f.alpha = 0.95;
  },
};

export default defineRenderers([person, car, truck, police, house, tower, plane, tank] as any);
