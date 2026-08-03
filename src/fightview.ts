import { TICK_MS, CANVAS_W, CANVAS_H } from "./fight/engine/constants";
import { createJadScenario } from "./fight/scenarios/jad";
import { step } from "./fight/engine/sim";
import { InputBuffer } from "./fight/input";
import { Renderer } from "./fight/render";
import { createSettingsPanel } from "./fight/settings";
import { createGuidePanel } from "./fight/guide";
import { DEFAULT_LOADOUT } from "./fight/engine/loadout";
import type { Loadout } from "./fight/engine/loadout";

// The Fight Caves trainer, folded in as a tab.
//
// This tab is different from every other one in the app: it owns a
// requestAnimationFrame loop and a window-level key listener, so it MUST be
// torn down when you navigate away. main.ts calls stop() before any redraw.
// Without that the loop keeps running against a detached canvas forever and
// key listeners stack up on every visit.

// Kept at module scope so a loadout survives tab switches within a session.
let loadout: Loadout = { ...DEFAULT_LOADOUT };
let reactionTicks = 2;

let running: { raf: number; input: InputBuffer } | null = null;

export function stop(): void {
  if (!running) return;
  cancelAnimationFrame(running.raf);
  running.input.destroy();
  running = null;
}

export function render(): HTMLElement {
  // Defensive: if something rendered this tab twice without stopping, the old
  // loop would keep drawing into an orphaned canvas.
  stop();

  const wrap = document.createElement("div");
  wrap.className = "fightwrap";

  const canvas = document.createElement("canvas");
  canvas.id = "game";
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  wrap.appendChild(canvas);

  const keys = document.createElement("p");
  keys.className = "note fightkeys";
  keys.textContent =
    "Click to move, click Jad to attack. 1 mage, 2 range, 3 melee, 0 none. Space toggles run, R restarts, H toggles hints.";
  wrap.appendChild(keys);

  const cols = document.createElement("div");
  cols.className = "fightcols";
  wrap.appendChild(cols);

  const renderer = new Renderer(canvas);
  const input = new InputBuffer(canvas);

  let state = createJadScenario(loadout, reactionTicks);
  let prev = state;

  cols.appendChild(
    createSettingsPanel(loadout, (next, ticks) => {
      loadout = next;
      reactionTicks = ticks;
      state = createJadScenario(loadout, reactionTicks);
      prev = state;
    }),
  );
  cols.appendChild(createGuidePanel());

  // Fixed-timestep loop: the simulation advances in discrete 600ms ticks while
  // rendering runs every animation frame and interpolates between the last two
  // sim states for smooth motion. Logic is tick-locked; visuals are not.
  let acc = 0;
  let last = performance.now();

  function frame(now: number) {
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250; // clamp after a tab-out; don't fast-forward the fight

    if (input.consumeReset()) {
      state = createJadScenario(loadout, reactionTicks);
      prev = state;
      acc = 0;
    }

    acc += dt;
    while (acc >= TICK_MS) {
      prev = state;
      state = step(state, input.drain());
      acc -= TICK_MS;
    }

    renderer.draw(prev, state, acc / TICK_MS, input.hints);
    if (running) running.raf = requestAnimationFrame(frame);
  }

  running = { raf: requestAnimationFrame(frame), input };
  return wrap;
}
