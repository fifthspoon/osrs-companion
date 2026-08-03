import type { RouteDef } from "./routes";
import * as worldmapview from "./worldmapview";
import * as run from "./runstate";

// The route view. The ordered list is the primary thing and works on its own,
// the map overlay is optional on top. Every stop is a teleport, so the list
// alone is enough to run the whole thing.

export function render(route: RouteDef, rerender: () => void): HTMLElement {
  const el = document.createElement("section");
  const next = run.nextStop(route);
  const done = run.visitedCount(route);

  const h2 = document.createElement("h2");
  h2.textContent = `${route.name} · ${done}/${route.stops.length}`;
  el.appendChild(h2);

  // The one loud thing: where to go right now.
  const card = document.createElement("div");
  card.className = next ? "card ready" : "card idle";
  if (next) {
    const info = document.createElement("div");
    const label = document.createElement("div");
    label.className = "note";
    label.textContent = "Go here next";
    info.appendChild(label);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = next.name;
    info.appendChild(name);

    const tp = document.createElement("div");
    tp.className = "tp";
    tp.textContent = next.teleport;
    info.appendChild(tp);
    card.appendChild(info);

    const btn = document.createElement("button");
    btn.className = "done";
    btn.textContent = "I'm here";
    btn.addEventListener("click", () => {
      run.toggle(route.id, next.id);
      rerender();
    });
    card.appendChild(btn);
  } else {
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = "Run complete. Nice.";
    card.appendChild(name);

    const btn = document.createElement("button");
    btn.className = "done";
    btn.textContent = "Reset";
    btn.addEventListener("click", () => {
      run.reset(route.id);
      rerender();
    });
    card.appendChild(btn);
  }
  el.appendChild(card);

  const ctx: worldmapview.ViewCtx = {
    visited: (id) => run.isVisited(route.id, id),
    nextId: next?.id ?? null,
    onVisit: (id) => {
      run.toggle(route.id, id);
      rerender();
    },
  };
  el.appendChild(worldmapview.render(route, ctx, rerender));

  const list = document.createElement("ol");
  list.className = "stops";
  route.stops.forEach((s) => {
    const visited = run.isVisited(route.id, s.id);
    const li = document.createElement("li");
    li.className = `${visited ? "visited" : ""}${next?.id === s.id ? " isnext" : ""}`;
    li.addEventListener("click", () => {
      run.toggle(route.id, s.id);
      rerender();
    });

    const head = document.createElement("div");
    head.className = "stophead";
    const name = document.createElement("span");
    name.className = "stopname";
    name.textContent = s.name;
    head.appendChild(name);
    if (s.diseaseFree) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "disease-free";
      head.appendChild(tag);
    }
    li.appendChild(head);

    const tp = document.createElement("div");
    tp.className = "tp";
    tp.textContent = s.teleport;
    li.appendChild(tp);

    if (s.alt) {
      const alt = document.createElement("div");
      alt.className = "note";
      alt.textContent = `alt: ${s.alt}`;
      li.appendChild(alt);
    }

    const meta = document.createElement("div");
    meta.className = "note";
    meta.textContent = s.requires ? `${s.patches} · needs ${s.requires}` : s.patches;
    li.appendChild(meta);

    list.appendChild(li);
  });
  el.appendChild(list);

  const foot = document.createElement("p");
  foot.className = "note";
  foot.textContent =
    "Every stop is a teleport, so order barely matters. Not skipping one does.";
  el.appendChild(foot);

  return el;
}
