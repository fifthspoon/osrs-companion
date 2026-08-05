import "./styles/index.scss";
import { TASKS } from "./data/tasks";
import { load, save, isReady } from "./data/taskState";
import type { Store } from "./data/taskState";
import { render as renderDailies } from "./components/dailies/dailies";
import { render as renderRoute } from "./components/route/route";
import { render as renderMap } from "./components/map/mapTab";
import { ROUTES } from "./data/routes";
import * as firecapeSim from "./components/firecapeSim/firecapeSim";
import * as market from "./components/market/market";
import * as navbar from "./components/navbar/navbar";
import { requestPermission, fire, clear } from "./lib/notify";

const root = document.getElementById("app") as HTMLElement;
let store: Store = load();

type Tab = "dailies" | string;
const savedTab = localStorage.getItem("osrs-companion:tab") ?? "dailies";
let tab: Tab = savedTab;
if (tab === "flips") tab = "market";
if (tab === "fight") tab = "firecape";
if (tab !== savedTab) localStorage.setItem("osrs-companion:tab", tab);

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

const nav = navbar.create(setTab, draw);
const body = document.createElement("div");
body.className = "body";

function footer(): HTMLElement {
  const f = document.createElement("footer");
  f.className = "sitefoot";

  const line = document.createElement("p");
  line.className = "sitefoot-loud";
  line.textContent =
    "This is free, and always will be. If anyone charged you for it, you were scammed.";
  f.appendChild(line);

  const sub = document.createElement("p");
  sub.appendChild(
    document.createTextNode("Free and open source under AGPL-3.0. Get it, and the source, at "),
  );
  const a = document.createElement("a");
  a.href = "https://github.com/fifthspoon/osrs-companion";
  a.textContent = "github.com/fifthspoon/osrs-companion";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  sub.appendChild(a);
  sub.appendChild(document.createTextNode(". Not affiliated with Jagex."));
  f.appendChild(sub);

  return f;
}

function draw() {
  firecapeSim.stop();
  market.stop();

  nav.setActive(tab);
  body.innerHTML = "";

  if (tab === "dailies") {
    renderDailies(body, store, Date.now(), handlers);
  } else if (tab === "map") {
    body.appendChild(renderMap(draw));
  } else if (tab === "market") {
    body.appendChild(market.render(draw));
  } else if (tab === "firecape") {
    body.appendChild(firecapeSim.render());
  } else {
    const route = ROUTES.find((r) => r.id === tab);
    if (route) body.appendChild(renderRoute(route, draw));
    else setTab("dailies");
  }
}

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

root.appendChild(nav.el);
root.appendChild(body);
root.appendChild(footer());

draw();
setInterval(tick, 1000);
