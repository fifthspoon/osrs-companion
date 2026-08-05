import "./player.scss";
import * as player from "../../data/characterData";
import { gp } from "../../lib/market/fmt";

const SUMMARY = ["attack", "strength", "defence", "hitpoints", "ranged", "magic", "prayer", "slayer"];

export function render(onChange: () => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "player";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "player__trigger";

  const pop = document.createElement("div");
  pop.className = "player__pop";
  pop.hidden = true;

  const main = document.createElement("div");
  main.className = "player__main";

  const roster = document.createElement("ul");
  roster.className = "player__roster";

  const stats = document.createElement("div");
  stats.className = "player__stats";

  const addRow = document.createElement("div");
  addRow.className = "player__row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "player__input";
  input.placeholder = "RuneScape name";
  input.maxLength = player.MAX_NAME;
  input.spellcheck = false;
  input.autocomplete = "off";

  const go = document.createElement("button");
  go.type = "button";
  go.className = "player__sync";
  go.textContent = "Sync";

  addRow.append(input, go);

  const status = document.createElement("p");
  status.className = "player__status";

  const manualLink = document.createElement("button");
  manualLink.type = "button";
  manualLink.className = "linkbtn";
  manualLink.textContent = "Enter levels manually";

  main.append(roster, stats, addRow, status, manualLink);

  const editor = document.createElement("div");
  editor.className = "player__editor";
  editor.hidden = true;

  const eName = document.createElement("input");
  eName.type = "text";
  eName.className = "player__input";
  eName.placeholder = "Character name";
  eName.maxLength = player.MAX_NAME;
  eName.spellcheck = false;
  eName.autocomplete = "off";

  const eCombat = document.createElement("p");
  eCombat.className = "player__head";

  const grid = document.createElement("div");
  grid.className = "player__fields";

  const fields = new Map<string, HTMLInputElement>();
  for (const s of player.SKILLS) {
    const label = document.createElement("label");
    label.className = "player__field";
    const n = document.createElement("span");
    n.className = "player__field-name";
    n.textContent = s.slice(0, 3);
    n.title = s;
    const f = document.createElement("input");
    f.type = "number";
    f.min = s === "hitpoints" ? "10" : "1";
    f.max = "99";
    f.className = "player__field-input";
    f.inputMode = "numeric";
    f.addEventListener("input", paintCombat);
    label.append(n, f);
    grid.appendChild(label);
    fields.set(s, f);
  }

  const eStatus = document.createElement("p");
  eStatus.className = "player__status";

  const eActions = document.createElement("div");
  eActions.className = "player__row player__row--editor";

  const eSave = document.createElement("button");
  eSave.type = "button";
  eSave.className = "player__sync";
  eSave.textContent = "Save character";

  const eCancel = document.createElement("button");
  eCancel.type = "button";
  eCancel.className = "linkbtn";
  eCancel.textContent = "Cancel";

  eActions.append(eSave, eCancel);
  editor.append(eName, grid, eCombat, eStatus, eActions);

  pop.append(main, editor);
  box.append(trigger, pop);

  let busy = false;

  function readLevels(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const s of player.SKILLS) {
      const floorLevel = s === "hitpoints" ? 10 : 1;
      const v = Number(fields.get(s)!.value);
      out[s] = Number.isFinite(v) && v > 0 ? Math.max(floorLevel, Math.min(99, Math.round(v))) : floorLevel;
    }
    return out;
  }

  function paintCombat() {
    const levels = readLevels();
    let total = 0;
    for (const s of player.SKILLS) total += levels[s];
    eCombat.textContent = `Combat ${player.combatOf(levels)} · Total ${total}`;
  }

  function paint() {
    const active = player.get();
    trigger.classList.toggle("player__trigger--set", !!active);
    trigger.textContent = active ? active.displayName : "Sync character";
    trigger.title = active
      ? `${active.displayName}, ${active.manual ? "entered by hand" : "synced"} ${new Date(active.syncedAt).toLocaleString()}`
      : "Load your character from WiseOldMan, or enter it by hand";

    roster.innerHTML = "";
    const all = player.list();
    for (const c of all) {
      const li = document.createElement("li");
      li.className = "player__entry";
      if (c.id === active?.id) li.classList.add("player__entry--active");

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "player__pick";
      const nm = document.createElement("span");
      nm.className = "player__name";
      nm.textContent = c.displayName;
      const meta = document.createElement("span");
      meta.className = "player__meta";
      meta.textContent = c.combatLevel !== null ? `cb ${c.combatLevel}` : "";
      pick.append(nm, meta);
      pick.addEventListener("click", () => {
        player.setActive(c.id);
        paint();
        onChange();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "player__remove";
      del.textContent = "x";
      del.title = `Remove ${c.displayName}`;
      del.addEventListener("click", () => {
        player.remove(c.id);
        paint();
        onChange();
      });

      li.append(pick, del);
      roster.appendChild(li);
    }
    roster.hidden = all.length === 0;

    stats.innerHTML = "";
    if (!active) return;

    const head = document.createElement("p");
    head.className = "player__head";
    const bits = [];
    if (active.combatLevel !== null) bits.push(`Combat ${active.combatLevel}`);
    bits.push(`Total ${active.totalLevel}`);
    if (active.exp) bits.push(`${gp(active.exp)} xp`);
    if (active.manual) bits.push("manual");
    else if (active.type && active.type !== "regular") bits.push(active.type);
    head.textContent = bits.join(" · ");
    stats.appendChild(head);

    const sg = document.createElement("ul");
    sg.className = "player__levels";
    let anyUnknown = false;
    for (const key of SUMMARY) {
      const s = active.skills[key];
      if (!s) continue;
      const unknown = player.isUnranked(s);
      if (unknown) anyUnknown = true;
      const li = document.createElement("li");
      li.className = "player__level";
      const n = document.createElement("span");
      n.className = "player__level-name";
      n.textContent = key.slice(0, 3);
      const v = document.createElement("b");
      v.className = "player__level-value";
      if (unknown) {
        v.classList.add("player__level-value--unknown");
        v.textContent = "Unknown";
        li.title = `${key} is not ranked on the hiscores, so the level is not published. It is not level 1.`;
      } else {
        v.textContent = String(s.level);
      }
      li.append(n, v);
      sg.appendChild(li);
    }
    sg.classList.toggle("player__levels--roomy", anyUnknown);
    stats.appendChild(sg);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "linkbtn";
    edit.textContent = active.manual ? "Edit levels" : "Edit levels by hand";
    edit.addEventListener("click", () => openEditor(active));
    stats.appendChild(edit);
  }

  function openEditor(from: player.Character | null) {
    const levels = from ? player.levelsOf(from) : player.defaultLevels();
    eName.value = from ? from.displayName.slice(0, player.MAX_NAME) : player.normalise(input.value);
    for (const s of player.SKILLS) fields.get(s)!.value = String(levels[s]);
    eStatus.textContent = "";
    eStatus.classList.remove("player__status--error");
    paintCombat();
    main.hidden = true;
    editor.hidden = false;
    pop.classList.add("player__pop--wide");
    eName.focus();
    eName.select();
  }

  function closeEditor() {
    editor.hidden = true;
    main.hidden = false;
    pop.classList.remove("player__pop--wide");
  }

  function open() {
    if (!pop.hidden) return;
    pop.hidden = false;
    closeEditor();
    input.value = "";
    status.textContent = "";
    status.classList.remove("player__status--error");
    paint();
    input.focus();
  }

  function close() {
    pop.hidden = true;
    closeEditor();
    status.textContent = "";
    status.classList.remove("player__status--error");
  }

  async function doSync() {
    if (busy) return;
    const name = player.normalise(input.value);
    input.value = name;
    if (!name) {
      input.focus();
      return;
    }
    busy = true;
    go.disabled = true;
    input.disabled = true;
    status.classList.remove("player__status--error");
    status.textContent = "Syncing...";
    try {
      await player.sync(name);
      status.textContent = "";
      input.value = "";
      paint();
      close();
      onChange();
    } catch (e) {
      status.classList.add("player__status--error");
      status.textContent = e instanceof Error ? e.message : "Sync failed.";
    } finally {
      busy = false;
      go.disabled = false;
      input.disabled = false;
      if (status.classList.contains("player__status--error")) {
        input.focus();
        input.select();
      }
    }
  }

  trigger.addEventListener("click", () => {
    if (pop.hidden) open();
    else close();
  });

  go.addEventListener("click", doSync);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSync();
  });

  manualLink.addEventListener("click", () => openEditor(null));

  eSave.addEventListener("click", () => {
    try {
      player.saveManual(eName.value, readLevels());
      paint();
      close();
      onChange();
    } catch (e) {
      eStatus.classList.add("player__status--error");
      eStatus.textContent = e instanceof Error ? e.message : "Could not save.";
      eName.focus();
    }
  });

  eName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") eSave.click();
  });

  eCancel.addEventListener("click", closeEditor);

  document.addEventListener("pointerdown", (e) => {
    if (pop.hidden) return;
    if (!box.contains(e.target as Node)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || pop.hidden) return;
    if (!editor.hidden) closeEditor();
    else close();
    trigger.focus();
  });

  paint();
  return box;
}
