import type { GameState, PlayerInput, Npc, Vec, AttackStyle } from "./types";
import {
  JAD_MAX_HIT_MAGIC,
  JAD_MAX_HIT_RANGE,
  JAD_MAX_HIT_MELEE,
  JAD_HEALER_SPAWN_HP,
  JAD_HEALER_COUNT,
  JAD_HEALER_HP,
  HEALER_HEAL,
  HEALER_ATTACK_SPEED,
  HEALER_MAX_HIT,
  HEALER_WALK_TILES,
  PLAYER_RUN_TILES,
  PLAYER_WALK_TILES,
  MELEE_RANGE,
  PRAYER_DRAIN_TICKS,
} from "./constants";
import { rollDamage, pickStyle } from "./combat";
import { nextRandom } from "./rng";
import { chebyshev, distToBlock, inBounds, stepToward, tileCenter, blockCenter } from "./grid";

const jadMaxHit = (style: AttackStyle): number =>
  style === "magic" ? JAD_MAX_HIT_MAGIC : style === "range" ? JAD_MAX_HIT_RANGE : JAD_MAX_HIT_MELEE;

export function step(prev: GameState, inputs: PlayerInput[]): GameState {
  const s: GameState = structuredClone(prev);
  s.tick += 1;
  s.player.prevPos = { ...prev.player.pos };
  for (const n of s.npcs) {
    const pn = prev.npcs.find((x) => x.id === n.id);
    n.prevPos = pn ? { ...pn.pos } : { ...n.pos };
  }

  const jad = () => s.npcs.find((n) => n.kind === "jad" && n.hp > 0);
  const blocked = (t: Vec): boolean => {
    if (!inBounds(t)) return true;
    const j = jad();
    return j ? distToBlock(t, j.pos, j.size) === 0 : false;
  };

  for (const inp of inputs) {
    if (inp.setPrayer !== undefined) s.player.overhead = inp.setPrayer;
    if (inp.toggleRun) s.player.running = !s.player.running;
    if (inp.click) {
      const hit = s.npcs.find(
        (n) => n.hp > 0 && distToBlock(inp.click as Vec, n.pos, n.size) === 0,
      );
      if (hit) {
        s.player.targetId = hit.id; // attack it (ranged: no need to close in)
        if (hit.kind === "healer") hit.aggro = true; // pulls it onto you
        s.player.moveTarget = null;
      } else {
        s.player.moveTarget = { ...inp.click }; // walk/run here; drops attack
        s.player.targetId = null;
      }
    }
  }

  if (s.over) return s;

  const j = jad();

  for (const npc of s.npcs) {
    if (npc.hp <= 0) continue;
    if (npc.kind === "jad") {
      npc.attackCd -= 1;
      if (npc.attackCd <= 0) {
        const adjacent = distToBlock(s.player.pos, npc.pos, npc.size) <= MELEE_RANGE;
        let style: AttackStyle;
        if (adjacent) {
          const r = nextRandom(s.seed);
          s.seed = r.seed;
          style = r.value < 1 / 3 ? "melee" : r.value < 2 / 3 ? "magic" : "range";
        } else {
          const pick = pickStyle(s.seed);
          s.seed = pick.seed;
          style = pick.style;
        }
        const from = blockCenter(npc.pos, npc.size);
        if (style === "melee") {
          npc.windup = { style, landsOn: s.tick }; // flashes this tick only
          s.projectiles.push({
            id: s.tick, style, from, to: tileCenter(s.player.pos),
            firedOn: s.tick, landsOn: s.tick,
          });
        } else {
          const delay = style === "magic" ? s.config.magicDelay : s.config.rangeDelay;
          npc.windup = { style, landsOn: s.tick + delay };
          s.projectiles.push({
            id: s.tick, style, from, to: tileCenter(s.player.pos),
            firedOn: s.tick, landsOn: s.tick + delay,
          });
        }
        npc.attackCd = npc.attackSpeed;
        s.stats.attacks += 1;
      } else if (npc.windup && s.tick > npc.windup.landsOn) {
        npc.windup = null;
      }
    } else {
      npc.target = npc.aggro ? "player" : "jad";
      npc.attackCd -= 1;
      if (npc.attackCd <= 0) {
        if (npc.target === "jad" && j && distToBlock(npc.pos, j.pos, j.size) <= MELEE_RANGE) {
          j.hp = Math.min(j.maxHp, j.hp + HEALER_HEAL);
          npc.attackCd = HEALER_ATTACK_SPEED;
          s.log.unshift(`t${s.tick}: healer restored ${HEALER_HEAL} to Jad`);
        } else if (npc.target === "player" && chebyshev(npc.pos, s.player.pos) <= MELEE_RANGE) {
          if (s.player.overhead !== "melee") {
            const hit = rollDamage(HEALER_MAX_HIT, 1.0, s.seed);
            s.seed = hit.seed;
            s.player.hp -= hit.damage;
          }
          npc.attackCd = HEALER_ATTACK_SPEED;
        }
      }
    }
  }

  movePlayer(s, blocked);
  for (const npc of s.npcs) {
    if (npc.kind !== "healer" || npc.hp <= 0) continue;
    moveHealer(s, npc, blocked);
  }

  for (const p of s.projectiles) {
    if (p.landsOn !== s.tick) continue;
    if (s.player.overhead === p.style) {
      s.stats.blocked += 1;
      s.log.unshift(`t${s.tick}: blocked ${p.style}`);
    } else {
      const hit = rollDamage(jadMaxHit(p.style), 1.0, s.seed);
      s.seed = hit.seed;
      s.player.hp -= hit.damage;
      s.stats.mispray += 1;
      s.log.unshift(`t${s.tick}: ${p.style.toUpperCase()} hit ${hit.damage}${p.style === "melee" ? " (too close!)" : ""}`);
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.landsOn > s.tick);

  const target = s.player.targetId != null ? s.npcs.find((n) => n.id === s.player.targetId && n.hp > 0) : undefined;
  if (target) {
    s.player.attackCd -= 1;
    if (s.player.attackCd <= 0) {
      const chance = target.kind === "jad" ? s.player.hitChance : 0.95;
      const hit = rollDamage(s.player.maxHit, chance, s.seed);
      s.seed = hit.seed;
      target.hp = Math.max(0, target.hp - hit.damage);
      s.player.attackCd = s.player.attackSpeed;
      if (target.hp <= 0) s.player.targetId = null;
    }
  } else {
    s.player.targetId = null;
  }

  if (!s.healersSpawned && j && j.hp <= JAD_HEALER_SPAWN_HP) {
    spawnHealers(s, j);
    s.healersSpawned = true;
    s.log.unshift(`t${s.tick}: ${JAD_HEALER_COUNT} healers spawned, kite them off Jad!`);
  }

  if (s.player.overhead !== "none") {
    if (s.tick % PRAYER_DRAIN_TICKS === 0) s.player.prayer -= 1;
    if (s.player.prayer <= 0) {
      s.player.prayer = 0;
      s.player.overhead = "none";
    }
  }

  if (s.player.hp <= 0) {
    s.player.hp = 0;
    s.player.alive = false;
    s.over = true;
    s.result = "dead";
  } else if (s.npcs.every((n) => n.hp <= 0)) {
    s.over = true;
    s.result = "win";
  }

  if (s.log.length > 8) s.log.length = 8;
  return s;
}

function movePlayer(s: GameState, blocked: (t: Vec) => boolean) {
  const p = s.player;
  if (!p.moveTarget) return;
  const speed = p.running ? PLAYER_RUN_TILES : PLAYER_WALK_TILES;
  for (let i = 0; i < speed; i++) {
    if (p.pos.x === p.moveTarget.x && p.pos.y === p.moveTarget.y) {
      p.moveTarget = null;
      break;
    }
    let next = stepToward(p.pos, p.moveTarget);
    if (blocked(next)) {
      const nx = { x: next.x, y: p.pos.y };
      const ny = { x: p.pos.x, y: next.y };
      if (!blocked(nx)) next = nx;
      else if (!blocked(ny)) next = ny;
      else break;
    }
    p.pos = next;
  }
}

function moveHealer(s: GameState, npc: Npc, blocked: (t: Vec) => boolean) {
  const j = s.npcs.find((n) => n.kind === "jad" && n.hp > 0);
  const targetPos = npc.target === "player" ? s.player.pos : j ? j.pos : null;
  if (!targetPos) return;
  const inRange =
    npc.target === "player"
      ? chebyshev(npc.pos, s.player.pos) <= MELEE_RANGE
      : j
        ? distToBlock(npc.pos, j.pos, j.size) <= MELEE_RANGE
        : true;
  if (inRange) return;
  for (let i = 0; i < HEALER_WALK_TILES; i++) {
    let next = stepToward(npc.pos, targetPos);
    if (blocked(next)) {
      const nx = { x: next.x, y: npc.pos.y };
      const ny = { x: npc.pos.x, y: next.y };
      if (!blocked(nx)) next = nx;
      else if (!blocked(ny)) next = ny;
      else break;
    }
    npc.pos = next;
  }
}

function spawnHealers(s: GameState, jad: Npc) {
  const spots: Vec[] = [
    { x: jad.pos.x - 1, y: jad.pos.y },
    { x: jad.pos.x + jad.size, y: jad.pos.y },
    { x: jad.pos.x - 1, y: jad.pos.y + jad.size - 1 },
    { x: jad.pos.x + jad.size, y: jad.pos.y + jad.size - 1 },
  ];
  let nextId = Math.max(...s.npcs.map((n) => n.id)) + 1;
  for (let i = 0; i < JAD_HEALER_COUNT; i++) {
    const spot = spots[i % spots.length];
    const pos = { x: Math.max(0, spot.x), y: Math.max(0, spot.y) };
    s.npcs.push({
      id: nextId++,
      kind: "healer",
      hp: JAD_HEALER_HP,
      maxHp: JAD_HEALER_HP,
      pos: { ...pos },
      prevPos: { ...pos },
      size: 1,
      attackSpeed: HEALER_ATTACK_SPEED,
      attackCd: HEALER_ATTACK_SPEED,
      windup: null,
      target: "jad",
      aggro: false,
    });
  }
}
