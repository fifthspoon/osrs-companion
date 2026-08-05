import "./navbar.scss";
import * as playerfield from "../player/player";
import { ROUTES } from "../../data/routes";

export type Tab = string;

export interface Navbar {
  el: HTMLElement;
  setActive: (tab: Tab) => void;
}

export function create(onSelect: (tab: Tab) => void, onPlayerChange: () => void): Navbar {
  const el = document.createElement("nav");
  el.className = "navbar";
  el.appendChild(playerfield.render(onPlayerChange));

  const buttons = new Map<Tab, HTMLButtonElement>();
  const items: [Tab, string][] = [
    ["dailies", "Dailies"],
    ...ROUTES.map((r) => [r.id, r.name] as [Tab, string]),
    ["map", "Map"],
    ["market", "Market"],
    ["firecape", "Fire cape (WIP)"],
  ];

  for (const [id, label] of items) {
    const b = document.createElement("button");
    b.className = "navbar__tab";
    b.textContent = label;
    b.addEventListener("click", () => onSelect(id));
    el.appendChild(b);
    buttons.set(id, b);
  }

  return {
    el,
    setActive(tab) {
      for (const [id, b] of buttons) b.classList.toggle("navbar__tab--active", id === tab);
    },
  };
}
