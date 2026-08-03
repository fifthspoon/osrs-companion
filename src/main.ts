import "./style.css";
import { TASKS } from "./tasks";
import { load, save, isReady } from "./store";
import type { Store } from "./store";
import { render as renderDailies } from "./ui";
import { render as renderRoute } from "./routeview";
import { ROUTES } from "./routes";
import * as fightview from "./fightview";
import { requestPermission, fire, clear } from "./notify";

const root = document.getElementById("app") as HTMLElement;
let store: Store = load();

type Tab = "dailies" | string; // string = a route id
let tab: Tab = (localStorage.getItem("osrs-companion:tab") as Tab) || "dailies";

// Tracks readiness between ticks so a notification fires on the transition into
// ready, not every second while it sits there ready.
const wasReady = new Map<string, boolean>();
for (const t of TASKS) {
  wasReady.set(t.id, isReady(t, store[t.id], Date.now()));
}

const handlers = {
  onDone(id: string) {
    store[id].lastDone = Date.now();
    clear(id);
    wasReady.set(id, false);
    persistAndDraw();
  },
  onUndo(id: string) {
    store[id].lastDone = null;
    clear(id);
    persistAndDraw();
  },
  onToggle(id: string) {
    store[id].enabled = !store[id].enabled;
    persistAndDraw();
  },
  async onEnableNotifications() {
    await requestPermission();
    persistAndDraw();
  },
};

function persistAndDraw() {
  save(store);
  draw();
}

function setTab(next: Tab) {
  tab = next;
  localStorage.setItem("osrs-companion:tab", next);
  draw();
}

function tabBar(): HTMLElement {
  const bar = document.createElement("nav");
  bar.className = "tabs";
  const items: [Tab, string][] = [
    ["dailies", "Dailies"],
    ...ROUTES.map((r) => [r.id, r.name] as [Tab, string]),
    ["fight", "Fire cape"],
  ];
  for (const [id, label] of items) {
    const b = document.createElement("button");
    b.textContent = label;
    if (tab === id) b.classList.add("active");
    b.addEventListener("click", () => setTab(id));
    bar.appendChild(b);
  }
  return bar;
}

function draw() {
  // The fight tab runs an animation loop and a window key listener, so it has
  // to be shut down before its DOM is thrown away. Safe no-op otherwise.
  fightview.stop();

  root.innerHTML = "";
  root.appendChild(tabBar());
  const body = document.createElement("div");
  body.className = "body";
  root.appendChild(body);

  if (tab === "dailies") {
    renderDailies(body, store, Date.now(), handlers);
  } else if (tab === "fight") {
    body.appendChild(fightview.render());
  } else {
    const route = ROUTES.find((r) => r.id === tab);
    if (route) body.appendChild(renderRoute(route, draw));
    else setTab("dailies");
  }
}

// One tick a second: check for ready transitions, then redraw countdowns.
// Notifications fire regardless of which tab you're looking at.
function tick() {
  const now = Date.now();
  for (const t of TASKS) {
    if (!store[t.id].enabled) continue;
    const ready = isReady(t, store[t.id], now);
    if (ready && !wasReady.get(t.id)) fire(t.id, t.name);
    wasReady.set(t.id, ready);
  }
  if (tab === "dailies") draw();
}

draw();
setInterval(tick, 1000);
