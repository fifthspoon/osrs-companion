import { TASKS } from "../../data/tasks";
import type { TaskDef } from "../../data/tasks";
import type { Store } from "../../data/taskState";
import { msUntilReady, isReady, nextDailyReset, MINUTE } from "../../data/taskState";
import { permission, shouldNotifyFor } from "../../lib/notify";

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

interface Handlers {
  onDone: (id: string) => void;
  onUndo: (id: string) => void;
  onToggle: (id: string) => void;
  onEnableNotifications: () => void;
}

export function render(root: HTMLElement, store: Store, now: number, h: Handlers): void {
  const active = TASKS.filter((t) => store[t.id].enabled);
  const ready = active.filter((t) => isReady(t, store[t.id], now));
  const waiting = active
    .filter((t) => !isReady(t, store[t.id], now))
    .sort((a, b) => msUntilReady(a, store[a.id], now) - msUntilReady(b, store[b.id], now));

  root.innerHTML = "";
  root.appendChild(header(store, now, h));

  if (ready.length) {
    root.appendChild(section("Ready now", ready.map((t) => readyCard(t, h))));
  } else if (active.length) {
    root.appendChild(nothingReady(waiting, store, now));
  } else {
    root.appendChild(emptyState());
  }

  if (waiting.length && ready.length) {
    root.appendChild(
      section(
        "Waiting",
        waiting.map((t) => waitingRow(t, store, now, h)),
      ),
    );
  } else if (waiting.length) {
    root.appendChild(
      section(
        "Also waiting",
        waiting.slice(1).map((t) => waitingRow(t, store, now, h)),
      ),
    );
  }

  root.appendChild(taskPicker(store, h));
}

function header(store: Store, now: number, h: Handlers): HTMLElement {
  const el = document.createElement("header");
  const perm = permission();

  const title = document.createElement("h1");
  title.textContent = "OSRS Companion";
  el.appendChild(title);

  const sub = document.createElement("p");
  sub.className = "sub";
  sub.textContent = `Daily reset in ${fmt(nextDailyReset(now) - now)}`;
  el.appendChild(sub);

  if (perm === "default") {
    const btn = document.createElement("button");
    btn.className = "notify-cta";
    btn.textContent = "Enable desktop notifications";
    btn.addEventListener("click", h.onEnableNotifications);
    el.appendChild(btn);
  } else if (perm === "denied") {
    const p = document.createElement("p");
    p.className = "sub warn";
    p.textContent = "Notifications blocked in browser settings. Timers still work here.";
    el.appendChild(p);
  }

  void store;
  return el;
}

function section(title: string, children: HTMLElement[]): HTMLElement {
  const el = document.createElement("section");
  const h2 = document.createElement("h2");
  h2.textContent = title;
  el.appendChild(h2);
  for (const c of children) el.appendChild(c);
  return el;
}

function readyCard(t: TaskDef, h: Handlers): HTMLElement {
  const card = document.createElement("div");
  card.className = "card ready";

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = t.name;
  info.appendChild(name);
  if (t.note) {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = t.note;
    info.appendChild(note);
  }
  card.appendChild(info);

  const btn = document.createElement("button");
  btn.className = "done";
  btn.textContent = "Done";
  btn.addEventListener("click", () => h.onDone(t.id));
  card.appendChild(btn);
  return card;
}

function waitingRow(t: TaskDef, store: Store, now: number, h: Handlers): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = t.name;
  row.appendChild(name);

  const right = document.createElement("span");
  right.className = "right";

  const time = document.createElement("span");
  time.className = "timer";
  time.textContent = fmt(msUntilReady(t, store[t.id], now));
  right.appendChild(time);

  const undo = document.createElement("button");
  undo.className = "undo";
  undo.title = "Mark as not done";
  undo.textContent = "undo";
  undo.addEventListener("click", () => h.onUndo(t.id));
  right.appendChild(undo);

  row.appendChild(right);
  return row;
}

function nothingReady(waiting: TaskDef[], store: Store, now: number): HTMLElement {
  const el = document.createElement("section");
  const card = document.createElement("div");
  card.className = "card idle";

  const msg = document.createElement("div");
  msg.className = "name";
  msg.textContent = "Nothing ready. Go do your own thing.";
  card.appendChild(msg);

  if (waiting.length) {
    const next = waiting[0];
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = `Next: ${next.name} in ${fmt(msUntilReady(next, store[next.id], now))}`;
    card.appendChild(note);
  }
  el.appendChild(card);
  return el;
}

function emptyState(): HTMLElement {
  const el = document.createElement("section");
  const card = document.createElement("div");
  card.className = "card idle";
  card.textContent = "No tasks turned on yet. Pick some below.";
  el.appendChild(card);
  return el;
}

function taskPicker(store: Store, h: Handlers): HTMLElement {
  const el = document.createElement("details");
  el.className = "picker";
  const sum = document.createElement("summary");
  sum.textContent = "Which tasks do you actually do?";
  el.appendChild(sum);

  for (const t of TASKS) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = store[t.id].enabled;
    cb.addEventListener("change", () => h.onToggle(t.id));
    label.appendChild(cb);

    const text = document.createElement("span");
    const bell = shouldNotifyFor(t.id) ? " 🔔" : "";
    const cd =
      t.kind === "daily"
        ? "daily"
        : t.minutes && t.minutes >= 60
          ? `${Math.round((t.minutes / 60) * 10) / 10}h`
          : `${t.minutes}m`;
    text.textContent = `${t.name} (${cd})${bell}`;
    label.appendChild(text);
    el.appendChild(label);
  }

  const foot = document.createElement("p");
  foot.className = "note";
  foot.textContent = "🔔 = fires a desktop notification. Long timers stay quiet on purpose.";
  el.appendChild(foot);

  void MINUTE;
  return el;
}
