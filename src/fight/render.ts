import type { GameState, Vec, Overhead, AttackStyle } from "./engine/types";
import { ARENA, CANVAS_W, CANVAS_H, TILE, GRID_W, GRID_H, MELEE_RANGE } from "./engine/constants";
import { tileCenter, distToBlock } from "./engine/grid";

const STYLE_COLOR: Record<AttackStyle, string> = {
  magic: "#6ab0ff",
  range: "#66dd66",
  melee: "#ff5555",
};

const OVERHEAD_COLOR: Record<Overhead, string> = {
  none: "#555",
  magic: "#6ab0ff",
  range: "#66dd66",
  melee: "#ffaa44",
};

function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  draw(prev: GameState, cur: GameState, alpha: number, hints: boolean) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawGrid();

    const jad = cur.npcs.find((n) => n.kind === "jad");
    const jadPrev = prev.npcs.find((n) => n.id === jad?.id);

    if (jad && jad.hp > 0) {
      const tl = lerp(
        { x: ARENA.x + (jadPrev ?? jad).pos.x * TILE, y: ARENA.y + (jadPrev ?? jad).pos.y * TILE },
        { x: ARENA.x + jad.pos.x * TILE, y: ARENA.y + jad.pos.y * TILE },
        alpha,
      );
      const size = jad.size * TILE;
      const wind = jad.windup;
      ctx.fillStyle = wind ? STYLE_COLOR[wind.style] : "#7a1f1f";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.fillRect(tl.x, tl.y, size, size);
      ctx.strokeRect(tl.x, tl.y, size, size);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Jad", tl.x + size / 2, tl.y + size / 2 + 4);
      this.bar(tl.x, tl.y - 10, size, 7, jad.hp / jad.maxHp, "#4caf50", "#5a1010");

      if (wind && hints) {
        ctx.fillStyle = STYLE_COLOR[wind.style];
        ctx.font = "bold 22px 'Segoe UI', sans-serif";
        const label = wind.style === "magic" ? "PRAY MAGE" : wind.style === "range" ? "PRAY RANGE" : "MELEE!";
        ctx.fillText(label, tl.x + size / 2, tl.y - 18);
      }
    }

    for (const npc of cur.npcs) {
      if (npc.kind !== "healer" || npc.hp <= 0) continue;
      const np = prev.npcs.find((n) => n.id === npc.id) ?? npc;
      const c = lerp(tileCenter(np.pos), tileCenter(npc.pos), alpha);
      ctx.fillStyle = npc.aggro ? "#ffaa44" : "#c04ac0";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.fillRect(c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4);
      ctx.strokeRect(c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4);
      this.bar(c.x - TILE / 2 + 2, c.y - TILE / 2 - 4, TILE - 4, 4, npc.hp / npc.maxHp, "#66dd66", "#402");
    }

    const now = cur.tick + alpha;
    for (const proj of cur.projectiles) {
      const span = proj.landsOn - proj.firedOn;
      const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (now - proj.firedOn) / span));
      const p = lerp(proj.from, proj.to, t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = STYLE_COLOR[proj.style];
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (cur.player.moveTarget) {
      const m = tileCenter(cur.player.moveTarget);
      ctx.strokeStyle = "#e8dc55";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x - 6, m.y - 6); ctx.lineTo(m.x + 6, m.y + 6);
      ctx.moveTo(m.x + 6, m.y - 6); ctx.lineTo(m.x - 6, m.y + 6);
      ctx.stroke();
    }

    const pl = cur.player;
    const plPos = lerp(tileCenter(prev.player.pos), tileCenter(pl.pos), alpha);
    const inMelee = jad ? distToBlock(pl.pos, jad.pos, jad.size) <= MELEE_RANGE : false;
    if (inMelee && jad && jad.hp > 0) {
      ctx.strokeStyle = "#ff3030";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(plPos.x, plPos.y, TILE, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = pl.alive ? "#d9c38a" : "#3a3a3a";
    ctx.fillRect(plPos.x - TILE / 2 + 3, plPos.y - TILE / 2 + 3, TILE - 6, TILE - 6);
    ctx.lineWidth = 4;
    ctx.strokeStyle = OVERHEAD_COLOR[pl.overhead];
    ctx.strokeRect(plPos.x - TILE / 2 + 3, plPos.y - TILE / 2 + 3, TILE - 6, TILE - 6);

    if (inMelee && jad && jad.hp > 0) {
      ctx.fillStyle = "#ff5555";
      ctx.font = "bold 14px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MELEE RANGE, back off", plPos.x, plPos.y + TILE + 6);
    }

    this.drawHud(cur, hints);
    if (cur.over) this.drawOverlay(cur);
  }

  private drawGrid() {
    const ctx = this.ctx;
    ctx.fillStyle = "#241f16";
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.strokeStyle = "#312a1d";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath();
      ctx.moveTo(ARENA.x + x * TILE, ARENA.y);
      ctx.lineTo(ARENA.x + x * TILE, ARENA.y + ARENA.h);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath();
      ctx.moveTo(ARENA.x, ARENA.y + y * TILE);
      ctx.lineTo(ARENA.x + ARENA.w, ARENA.y + y * TILE);
      ctx.stroke();
    }
  }

  private drawHud(s: GameState, hints: boolean) {
    const ctx = this.ctx;
    const x = ARENA.x + ARENA.w + 20;
    let y = 34;
    ctx.textAlign = "left";

    ctx.fillStyle = "#e8dcc0";
    ctx.font = "bold 17px 'Segoe UI', sans-serif";
    ctx.fillText("OSRS Tick Trainer", x, y);

    ctx.font = "12px 'Segoe UI', sans-serif";
    y += 24;
    ctx.fillStyle = "#8a8272";
    ctx.fillText(`Tick ${s.tick}   Run: ${s.player.running ? "ON" : "OFF"}`, x, y);

    y += 24;
    ctx.fillStyle = "#e8dcc0";
    ctx.fillText(`HP ${s.player.hp}/${s.player.maxHp}`, x, y);
    this.bar(x + 92, y - 11, 150, 12, s.player.hp / s.player.maxHp, "#4caf50", "#402");
    y += 22;
    ctx.fillStyle = "#e8dcc0";
    ctx.fillText(`Pray ${s.player.prayer}/${s.player.maxPrayer}`, x, y);
    this.bar(x + 92, y - 11, 150, 12, s.player.prayer / s.player.maxPrayer, "#6ab0ff", "#123");

    y += 24;
    ctx.fillStyle = "#e8dcc0";
    ctx.fillText(`Overhead: ${s.player.overhead.toUpperCase()}`, x, y);

    const healers = s.npcs.filter((n) => n.kind === "healer" && n.hp > 0).length;
    if (s.healersSpawned) {
      y += 20;
      ctx.fillStyle = healers ? "#ffaa44" : "#66dd66";
      ctx.fillText(`Healers alive: ${healers}`, x, y);
    }

    y += 28;
    ctx.fillStyle = "#8a8272";
    ctx.fillText(`Attacks faced: ${s.stats.attacks}`, x, y);
    y += 17;
    ctx.fillStyle = "#66dd66";
    ctx.fillText(`Blocked: ${s.stats.blocked}`, x, y);
    y += 17;
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText(`Mispray: ${s.stats.mispray}`, x, y);

    y += 28;
    ctx.fillStyle = "#8a8272";
    for (const line of [
      "1 / 2 / 3  pray Mage / Range / Melee",
      "0 / Esc  prayer off",
      "Click enemy  attack   ·   Click ground  move",
      "Space  toggle run",
      `H  hints ${hints ? "ON" : "OFF"}   ·   R  restart`,
    ]) {
      ctx.fillText(line, x, y);
      y += 16;
    }

    y += 10;
    ctx.fillStyle = "#5f5949";
    for (const line of s.log) {
      ctx.fillText(line, x, y);
      y += 14;
    }
  }

  private drawOverlay(s: GameState) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.68)";
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    const cx = ARENA.x + ARENA.w / 2;
    const cy = ARENA.y + ARENA.h / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = s.result === "win" ? "#66dd66" : "#ff6b6b";
    ctx.font = "bold 44px 'Segoe UI', sans-serif";
    ctx.fillText(s.result === "win" ? "JAD DOWN" : "YOU DIED", cx, cy - 20);

    const total = s.stats.blocked + s.stats.mispray;
    const acc = total ? Math.round((s.stats.blocked / total) * 100) : 100;
    ctx.fillStyle = "#e8dcc0";
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.fillText(`Prayer accuracy: ${acc}%  (${s.stats.blocked}/${total})`, cx, cy + 20);
    ctx.fillStyle = "#8a8272";
    ctx.fillText("Press R to try again", cx, cy + 50);
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, fill: string, bg: string) {
    const ctx = this.ctx;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
}
