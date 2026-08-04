import { createMap } from "./map/component";

export function render(rerender: () => void): HTMLElement {
  const el = document.createElement("section");
  el.className = "mapsection";

  const h2 = document.createElement("h2");
  h2.textContent = "World map";
  el.appendChild(h2);

  el.appendChild(
    createMap({
      id: "standalone",
      status: "Scroll to zoom, drag to pan. Right drag pans without dropping a marker.",
      onChange: rerender,
    }),
  );

  return el;
}
