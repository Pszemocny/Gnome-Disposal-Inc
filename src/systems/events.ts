import * as THREE from 'three';
import { ctx, lvl, rand } from '../core/context';
import { ufoGeometry, vcMat } from '../world/models';
import { POP_TIME, isFree, type Gnome } from '../entities/gnomes';
import { MAX_HOLE_LEVEL } from '../data/holeLevels';
import { Tornado } from './tornado';

interface EventDef {
  id: string;
  name: string;
  sub: string;
  weight: number;
  ok: () => boolean;
}

// exported for the legend (L), which lists events from this table
export const EVENTS: EventDef[] = [
  { id: 'rain', name: 'GNOME RAIN', sub: 'It is raining rare gnomes. Hallelujah.', weight: 3, ok: () => true },
  { id: 'golden', name: 'GOLDEN HOUR', sub: 'Every gnome turns to gold for 25 s! Catch them!', weight: 0, ok: () => false }, // only the Golden Hour mushroom starts it
  { id: 'parade', name: 'GNOME PARADE', sub: 'A conga line! Parade gnomes are worth x3.', weight: 2, ok: () => true },
  { id: 'wind', name: 'GUSTY WIND', sub: 'A side wind for 30 s: aim against it, thrown gnomes drift!', weight: 1.5, ok: () => ctx.state.holeLevel >= 3 },
  { id: 'rush', name: 'OVERTIME', sub: 'The factory goes wild for 20 s. Everything eaten now is worth x1.5.', weight: 2, ok: () => true },
  { id: 'burp', name: 'HOLE BURP', sub: 'The hole had too much. Grab the coins!', weight: 2, ok: () => true },
  { id: 'bloom', name: 'MUSHROOM BLOOM', sub: 'Magic mushrooms sprout everywhere.', weight: 2, ok: () => true },
  { id: 'quake', name: 'EARTHQUAKE', sub: 'Everything slides towards the hole!', weight: 1.5, ok: () => true },
  { id: 'uprising', name: 'GNOME UPRISING', sub: 'They fight back! Every gnome is angry for 20 s.', weight: 1.5, ok: () => ctx.state.holeLevel >= 3 },
  { id: 'gnomenado', name: 'GNOMENADO!', sub: 'A tornado crosses the yard. Gnomes fly, some straight into the hole!', weight: 1.5, ok: () => ctx.state.holeLevel >= 3 },
  { id: 'ufo', name: 'CLOSE ENCOUNTER', sub: 'A UFO is stealing your gnomes! Hit it 3 times with thrown gnomes.', weight: 5, ok: () => ctx.state.holeLevel >= 4 }, // PP 2026-10-20 6b
  { id: 'visitor', name: '...', sub: 'Something is watching you from the dark.', weight: 3, ok: () => ctx.state.holeLevel >= 6 && ctx.env.isNight },
  { id: 'king', name: 'THE KING GNOME', sub: 'His Majesty is here. He is very heavy. Use your machines!', weight: 3, ok: () => ctx.state.holeLevel >= 10 && !ctx.gnomes.list.some((g) => g.type.id === 'king') }, // PP 2026-10-20 6b
];

export class Events {
  goldenHour = 0;
  // Golden Hour type swaps, staggered so they read as a wave; `to` = the type the gnome becomes
  private swaps: { g: Gnome; at: number; to: string }[] = [];
  private next = 60;
  private rain = 0;
  private uprising = 0;
  private quake = 0;
  private parade = 0;
  private burp = 0;
  wind = 0;
  windDir = new THREE.Vector3(1, 0, 0);
  readonly tornado = new Tornado();
  // spin and roll: rad/s, wind up from 0 (animation rule 7)
  private ufo: { mesh: THREE.Group; beam: THREE.Mesh; target: THREE.Vector3; hits: number; t: number; crashing: boolean; vy: number; spin: number; roll: number } | null = null;

  update(dt: number): void {
    if (ctx.state.holeLevel >= 2) {
      this.next -= dt * (1 + lvl('lucky') * 0.15);
      if (this.next <= 0) {
        this.next = rand(70, 140);
        const pool = EVENTS.filter((e) => e.ok());
        const total = pool.reduce((s, e) => s + e.weight, 0);
        let r = Math.random() * total;
        for (const e of pool) {
          r -= e.weight;
          if (r <= 0) {
            this.start(e.id);
            break;
          }
        }
      }
    }
    if (ctx.env.isNight && ctx.state.holeLevel >= 6 && Math.random() < dt / 70) this.spawnVisitor();

    if (this.goldenHour > 0) {
      this.goldenHour -= dt;
      if (this.goldenHour <= 0) this.queueSwaps(ctx.gnomes.list.filter((g) => g.goldFrom), null);
    }
    if (this.swaps.length) this.runSwaps();

    if (this.rain > 0) {
      this.rain -= dt;
      if (Math.random() < dt * 12) {
        const h = ctx.env.half - 2;
        const p = new THREE.Vector3(rand(-h, h), rand(14, 24), rand(-h, h));
        // ordinary gnomes only come from the factory (PP 2026-10-19): the sky rains the special ones
        const g = ctx.gnomes.spawn(ctx.gnomes.pickSpecialType(), p, { awake: false });
        if (g) ctx.gnomes.ragdoll(g, 4);
      }
    }

    if (this.burp > 0) {
      this.burp -= dt;
      if (Math.random() < dt * 10) ctx.coins.burst(ctx.hole.valueScale * rand(1, 3), ctx.env.hole.clone().setY(0.5), 1.6);
    }

    if (this.quake > 0) {
      this.quake -= dt;
      ctx.fx.shake(dt * 2);
      for (const g of ctx.gnomes.list) {
        if (!isFree(g)) continue;
        const p = g.body.translation();
        const hx = ctx.env.hole.x - p.x;
        const hz = ctx.env.hole.z - p.z;
        const d = Math.hypot(hx, hz) || 1;
        if (g.state !== 'ragdoll') ctx.gnomes.ragdoll(g, 2);
        const k = 3 * g.type.mass * dt;
        g.body.applyImpulse({ x: (hx / d) * k + rand(-1, 1) * k, y: Math.random() < dt * 3 ? 2 * g.type.mass : 0, z: (hz / d) * k + rand(-1, 1) * k }, true);
      }
    }

    if (this.wind > 0) {
      this.wind -= dt;
      // only airborne player throws drift: it is an aiming challenge, not chaos on the ground
      for (const g of ctx.gnomes.list) {
        if (g.state !== 'ragdoll' || !g.throwPos || g.touchedGround) continue;
        const k = 6 * g.body.mass() * dt;
        g.body.applyImpulse({ x: this.windDir.x * k, y: 0, z: this.windDir.z * k }, true);
      }
      if (Math.random() < dt * 12) {
        const pp = ctx.player.position;
        ctx.fx.wind(new THREE.Vector3(pp.x + rand(-10, 10), rand(1, 4), pp.z + rand(-10, 10)), this.windDir);
      }
    }

    if (this.uprising > 0) {
      this.uprising -= dt;
      if (this.uprising <= 0) for (const g of ctx.gnomes.list) g.angryOverride = false;
    }

    if (this.parade > 0) {
      this.parade -= dt;
      if (this.parade <= 0) for (const g of ctx.gnomes.list) g.parade = -1;
      else if (Math.random() < dt * 2) {
        const pg = ctx.gnomes.list.find((g) => g.parade >= 0 && g.state === 'walk');
        if (pg) ctx.gnomes.say(pg, ['Conga!', 'La la la!', 'Hup hup!', 'Parade!'][Math.floor(Math.random() * 4)]);
      }
    }

    this.updateUfo(dt);
    this.tornado.update(dt);
  }

  start(id: string): void {
    const def = EVENTS.find((e) => e.id === id)!;
    ctx.state.stats.events++;
    ctx.hud.banner(def.name, def.sub);
    ctx.audio.tier();
    switch (id) {
      case 'rain':
        this.rain = 4;
        break;
      case 'golden':
        this.goldenHour = 25;
        // a new Golden Hour cancels the turn-back of the last one; those gnomes turn back when this one ends
        this.swaps = [];
        this.queueSwaps(ctx.gnomes.list.filter((g) => isFree(g) && g.type.id !== 'king' && g.type.id !== 'golden'), 'golden');
        break;
      case 'rush':
        ctx.factory.rush = 20;
        break;
      case 'wind': {
        this.wind = 30;
        const a = rand(0, Math.PI * 2);
        this.windDir.set(Math.cos(a), 0, Math.sin(a));
        break;
      }
      case 'parade': {
        this.parade = 60;
        // gnomes already in the yard join the conga line; the factory makes the missing ones
        const recruits = ctx.gnomes.list.filter((g) => isFree(g) && g.type.id !== 'king' && g.type.id !== 'shadow' && g.type.id !== 'boom').slice(0, 16);
        recruits.forEach((g, i) => {
          ctx.gnomes.wake(g);
          g.parade = i;
        });
        for (let i = recruits.length; i < 16; i++) {
          ctx.factory.produce(i % 2 ? 'blue' : 'classic', (g) => {
            // they come out one by one; the parade may be over before a late one
            if (this.parade <= 0) return;
            g.awake = true;
            g.parade = i;
          });
        }
        break;
      }
      case 'burp':
        this.burp = 2.5;
        ctx.fx.shake(0.5);
        ctx.audio.rumble(1);
        break;
      case 'bloom': {
        const h = ctx.env.half - 3;
        for (let i = 0; i < 8; i++) ctx.mushrooms.spawn(ctx.mushrooms.pickDef(), new THREE.Vector3(rand(-h, h), 0, rand(-h, h)), false);
        break;
      }
      case 'quake':
        this.quake = 5;
        ctx.audio.rumble(5);
        break;
      case 'uprising':
        this.uprising = 20;
        for (const g of ctx.gnomes.list) {
          ctx.gnomes.wake(g);
          g.angryOverride = true;
        }
        ctx.audio.voice('curse', 0.8);
        break;
      case 'gnomenado':
        this.tornado.start();
        break;
      case 'ufo':
        this.spawnUfo();
        break;
      case 'visitor':
        this.spawnVisitor();
        break;
      case 'king': {
        ctx.factory.produce('king');
        ctx.fx.shake(0.7);
        ctx.audio.rumble(2);
        break;
      }
    }
  }

  // Collect first, swap later (a swap removes the gnome): nearest to the player first, spread over 0.5 s.
  // `to` null = back to the type the gnome had before Golden Hour.
  private queueSwaps(list: Gnome[], to: string | null): void {
    const pp = ctx.player.position;
    const dist = (g: Gnome) => {
      const p = g.body.translation();
      return Math.hypot(p.x - pp.x, p.z - pp.z);
    };
    list.sort((a, b) => dist(a) - dist(b));
    list.forEach((g, i) => this.swaps.push({ g, at: ctx.time + (i / list.length) * 0.5, to: to ?? g.goldFrom! }));
  }

  private runSwaps(): void {
    const keep: typeof this.swaps = [];
    for (const s of this.swaps) {
      const g = s.g;
      // eaten or gone, or Golden Hour ended before this gnome's turn
      if (!ctx.gnomes.list.includes(g) || (s.to === 'golden' && this.goldenHour <= 0)) continue;
      if (s.at > ctx.time || !isFree(g)) {
        // grabbed before its turn: stays as it is; held or stashed when the event ends: turns back once free
        if (s.at > ctx.time || s.to !== 'golden') keep.push(s);
        continue;
      }
      const p = g.body.translation();
      const at = new THREE.Vector3(p.x, p.y, p.z);
      const from = g.type.id;
      const n = ctx.gnomes.retype(g, s.to);
      if (!n) continue;
      if (s.to === 'golden') {
        n.goldFrom = from;
        ctx.fx.burst(at, 0xffd23f, 16);
        ctx.audio.coin(rand(1.3, 1.7));
      } else ctx.fx.puff(at, 0x9a9a9a);
    }
    this.swaps = keep;
  }

  private spawnVisitor(): void {
    if (ctx.gnomes.list.filter((g) => g.type.id === 'shadow').length >= 2) return;
    const h = ctx.env.half - 1.5;
    // comes out of the dark behind the player, not from the fence (PP 2026-10-21 "zaden sie we mnie nie patrzyl")
    const pp = ctx.player.position;
    const back = ctx.player.yaw + Math.PI;
    let p: THREE.Vector3 | null = null;
    // every try stays within 60° of straight behind; none fits → the fence spawn below
    for (let i = 0; i < 6 && !p; i++) {
      const a = back + rand(-Math.PI / 3, Math.PI / 3);
      const d = rand(7, 10);
      const x = pp.x - Math.sin(a) * d;
      const z = pp.z - Math.cos(a) * d;
      if (Math.abs(x) <= h && Math.abs(z) <= h && ctx.env.holeDist(x, z) >= ctx.env.holeRadius + 2 && !ctx.mushrooms.inTool(x, z) && !ctx.factory.inside(x, z)) p = new THREE.Vector3(x, 0.7, z);
    }
    if (!p) {
      const side = Math.floor(Math.random() * 4);
      const t = rand(-h, h);
      p = side === 0 ? new THREE.Vector3(t, 0.7, -h) : side === 1 ? new THREE.Vector3(t, 0.7, h) : side === 2 ? new THREE.Vector3(-h, 0.7, t) : new THREE.Vector3(h, 0.7, t);
    }
    const g = ctx.gnomes.spawn('shadow', p, { awake: true, yaw: Math.atan2(pp.x - p.x, pp.z - p.z) });
    if (g) {
      g.pop = POP_TIME;
      ctx.fx.burst(p.clone().setY(0.6), 0x000000, 25);
      ctx.gnomes.say(g, 'we see you', true);
      ctx.audio.clicks(p.x, p.z);
    }
    ctx.audio.whisper();
  }

  private spawnUfo(): void {
    if (this.ufo) return;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(ufoGeometry(), vcMat({ metalness: 0.6, roughness: 0.3, emissive: 0x222222 }));
    body.castShadow = true;
    mesh.add(body);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 3.2, 12, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9affa0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = -6;
    mesh.add(beam);
    mesh.position.set(80, 30, 0);
    ctx.scene.add(mesh);
    this.ufo = { mesh, beam, target: this.ufoSpot(), hits: 0, t: 0, crashing: false, vy: 0, spin: 0, roll: 0 };
  }

  private ufoSpot(): THREE.Vector3 {
    const h = ctx.env.half - 5;
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Vector3(rand(-h, h), 12, rand(-h, h));
      if (ctx.env.holeDist(v.x, v.z) > ctx.env.holeRadius + 4) return v;
    }
    return new THREE.Vector3(10, 12, 10);
  }

  private updateUfo(dt: number): void {
    const u = this.ufo;
    if (!u) return;
    u.t += dt;
    const m = u.mesh;
    u.spin = THREE.MathUtils.damp(u.spin, 2, 4, dt);
    m.rotation.y += u.spin * dt;
    if (u.crashing) {
      u.vy -= 20 * dt;
      m.position.y += u.vy * dt;
      u.roll = THREE.MathUtils.damp(u.roll, 3, 4, dt);
      m.rotation.z += u.roll * dt;
      if (Math.random() < dt * 30) ctx.fx.puff(m.position.clone(), 0x333333);
      if (m.position.y < 0.5) {
        ctx.fx.burst(m.position.clone(), 0xffe066, 120);
        ctx.fx.shake(1);
        ctx.audio.rumble(1.2);
        ctx.coins.burst(ctx.hole.valueScale * 150, m.position.clone().setY(1), 2.5);
        ctx.mushrooms.spawn(ctx.mushrooms.pickDef(), m.position.clone().setY(0), false);
        // a downed UFO fills 40 % of the bar (1000 XP at level 10; PP 2026-10-21 "za stracenie ufo"), no multipliers
        const xp = ctx.state.holeLevel < MAX_HOLE_LEVEL ? Math.round(0.4 * ctx.hole.xpNeeded) : 0;
        ctx.hole.addXp(xp);
        ctx.hud.bigText('UFO DOWN!', '#9affa0', xp ? '+' + xp + ' XP' : '');
        ctx.achievements.unlock('ufo');
        this.removeUfo();
      }
      return;
    }
    if (u.t > 45) {
      m.position.y += dt * 15;
      u.beam.visible = false;
      if (m.position.y > 80) this.removeUfo();
      return;
    }
    m.position.lerp(u.target, 1 - Math.exp(-0.8 * dt));
    if (m.position.distanceTo(u.target) < 1 && Math.random() < dt * 0.15) u.target = this.ufoSpot();
    ctx.audio.ufo();
    const beamOn = m.position.distanceTo(u.target) < 4;
    u.beam.visible = beamOn;
    const abducted: Gnome[] = [];
    for (const g of ctx.gnomes.list) {
      if (!isFree(g)) continue;
      const p = g.body.translation();
      const dx = p.x - m.position.x;
      const dz = p.z - m.position.z;
      const dh = Math.hypot(dx, dz);
      // hit by a thrown gnome
      if (g.thrownBy === 'player' && g.state === 'ragdoll' && Math.abs(p.y - m.position.y) < 1.6 && dh < 3.3) {
        u.hits++;
        g.thrownBy = null;
        g.body.setLinvel({ x: dx * 2, y: -4, z: dz * 2 }, true);
        ctx.fx.burst(new THREE.Vector3(p.x, p.y, p.z), 0xffe066, 30);
        ctx.audio.kick();
        ctx.fx.shake(0.3);
        ctx.hud.toast(`UFO hit! ${u.hits}/3`, 'good');
        if (u.hits >= 3) {
          u.crashing = true;
          u.beam.visible = false;
          return;
        }
        continue;
      }
      if (beamOn && dh < 3 && p.y < m.position.y) {
        if (g.state !== 'ragdoll') ctx.gnomes.ragdoll(g, 3);
        g.body.setLinvel({ x: -dx * 0.5, y: 4, z: -dz * 0.5 }, true);
        if (p.y > m.position.y - 1.2) abducted.push(g);
      }
    }
    for (const g of abducted) ctx.gnomes.remove(g);
  }

  private removeUfo(): void {
    if (!this.ufo) return;
    ctx.scene.remove(this.ufo.mesh);
    this.ufo = null;
  }
}
