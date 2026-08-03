import type { PlayerInput } from "./engine/types";
import { pxToTile } from "./engine/grid";

// Captures input continuously but hands it to the sim in per-tick batches.
// Clicks and prayer switches queue and resolve on the NEXT tick, exactly like a
// click in OSRS resolves on the next server tick, not the instant you press.
export class InputBuffer {
  private pending: PlayerInput[] = [];
  private reset = false;
  private detach: () => void;
  hints = true; // UI-only: show the "PRAY MAGE/RANGE" coaching label

  constructor(canvas: HTMLCanvasElement, target: Window = window) {
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    const onClick = (e: MouseEvent) => this.onClick(e, canvas);
    const onCtx = (e: MouseEvent) => e.preventDefault();
    target.addEventListener("keydown", onKey);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("contextmenu", onCtx);
    // Without this, leaving and re-entering the fight stacks another keydown
    // listener on the window and every prayer switch queues twice, then three
    // times, and so on.
    this.detach = () => {
      target.removeEventListener("keydown", onKey);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("contextmenu", onCtx);
    };
  }

  destroy(): void {
    this.detach();
  }

  private onClick(e: MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const tile = pxToTile(px, py);
    if (tile) this.pending.push({ click: tile });
  }

  private onKey(e: KeyboardEvent) {
    // The loadout panel sits on the same page and is full of number inputs.
    // Without this guard, typing a "1" into a stat box eats the digit and
    // switches your prayer instead.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
      return;
    }
    switch (e.key) {
      case "1":
        this.pending.push({ setPrayer: "magic" });
        break;
      case "2":
        this.pending.push({ setPrayer: "range" });
        break;
      case "3":
        this.pending.push({ setPrayer: "melee" });
        break;
      case "0":
      case "Escape":
        this.pending.push({ setPrayer: "none" });
        break;
      case " ":
        this.pending.push({ toggleRun: true });
        break;
      case "r":
      case "R":
        this.reset = true;
        break;
      case "h":
      case "H":
        this.hints = !this.hints;
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  drain(): PlayerInput[] {
    const p = this.pending;
    this.pending = [];
    return p;
  }

  consumeReset(): boolean {
    const r = this.reset;
    this.reset = false;
    return r;
  }
}
