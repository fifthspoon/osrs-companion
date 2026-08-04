import * as player from "./player";
import { gp } from "./market/fmt";

const SUMMARY = ["attack", "strength", "defence", "hitpoints", "ranged", "magic", "prayer", "slayer"];

export function render(onChange: () => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "playerbox";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "playertrigger";

  const pop = document.createElement("div");
  pop.className = "playerpop";
  pop.hidden = true;

  const main = document.createElement("div");
  main.className = "playermain";

  const roster = document.createElement("ul");
  roster.className = "playerroster";

  const stats = document.createElement("div");
  stats.className = "playerstats";

  const addRow = document.createElement("div");
  addRow.className = "playerrow";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "playerinput";
  input.placeholder = "RuneScape name";
  input.maxLength = player.MAX_NAME;
  input.spellcheck = false;
  input.autocomplete = "off";

  const go = document.createElement("button");
  go.type = "button";
  go.className = "syncbtn";
  go.textContent = "Sync";

  addRow.append(input, go);

  const status = document.createElement("p");
  status.className = "playerstatus";

  const manualLink = document.createElement("button");
  manualLink.type = "button";
  manualLink.className = "linkbtn";
  manualLink.textContent = "Enter levels manually";

  main.append(roster, stats, addRow, status, manualLink);

  const editor = document.createElement("div");
  editor.className = "playereditor";
  editor.hidden = true;

  const eName = document.createElement("input");
  eName.type = "text";
  eName.className = "playerinput";
  eName.placeholder = "Character name";
  eName.maxLength = player.MAX_NAME;
  eName.spellcheck = false;
  eName.autocomplete = "off";

  const eCombat = document.createElement("p");
  eCombat.className = "playerhead";

  const grid = document.createElement("div");
  grid.className = "playerskills";

  const fields = new Map<string, HTMLInputElement>();
  for (const s of player.SKILLS) {
    const label = document.createElement("label");
    label.className = "skfield";
    const n = document.createElement("span");
    n.textContent = s.slice(0, 3);
    n.title = s;
    const f = document.createElement("input");
    f.type = "number";
    f.min = s === "hitpoints" ? "10" : "1";
    f.max = "99";
    f.inputMode = "numeric";
    f.addEventListener("input", paintCombat);
    label.append(n, f);
    grid.appendChild(label);
    fields.set(s, f);
  }

  const eStatus = document.createElement("p");
  eStatus.className = "playerstatus";

  const eActions = document.createElement("div");
  eActions.className = "playerrow";

  const eSave = document.createElement("button");
  eSave.type = "button";
  eSave.className = "syncbtn";
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
    trigger.classList.toggle("set", !!active);
    trigger.textContent = active ? active.displayName : "Sync character";
    trigger.title = active
      ? `${active.displayName}, ${active.manual ? "entered by hand" : "synced"} ${new Date(active.syncedAt).toLocaleString()}`
      : "Load your character from WiseOldMan, or enter it by hand";

    roster.innerHTML = "";
    const all = player.list();
    for (const c of all) {
      const li = document.createElement("li");
      if (c.id === active?.id) li.classList.add("on");

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "pickbtn";
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = c.displayName;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = c.combatLevel !== null ? `cb ${c.combatLevel}` : "";
      pick.append(nm, meta);
      pick.addEventListener("click", () => {
        player.setActive(c.id);
        paint();
        onChange();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delbtn";
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
    head.className = "playerhead";
    const bits = [];
    if (active.combatLevel !== null) bits.push(`Combat ${active.combatLevel}`);
    bits.push(`Total ${active.totalLevel}`);
    if (active.exp) bits.push(`${gp(active.exp)} xp`);
    if (active.manual) bits.push("manual");
    else if (active.type && active.type !== "regular") bits.push(active.type);
    head.textContent = bits.join(" · ");
    stats.appendChild(head);

    const sg = document.createElement("ul");
    sg.className = "playergrid";
    for (const key of SUMMARY) {
      const s = active.skills[key];
      if (!s) continue;
      const li = document.createElement("li");
      const n = document.createElement("span");
      n.className = "sk";
      n.textContent = key.slice(0, 3);
      const v = document.createElement("b");
      v.textContent = String(s.level);
      li.append(n, v);
      sg.appendChild(li);
    }
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
    eStatus.classList.remove("err");
    paintCombat();
    main.hidden = true;
    editor.hidden = false;
    pop.classList.add("wide");
    eName.focus();
    eName.select();
  }

  function closeEditor() {
    editor.hidden = true;
    main.hidden = false;
    pop.classList.remove("wide");
  }

  function open() {
    if (!pop.hidden) return;
    pop.hidden = false;
    closeEditor();
    input.value = "";
    status.textContent = "";
    status.classList.remove("err");
    paint();
    input.focus();
  }

  function close() {
    pop.hidden = true;
    closeEditor();
    status.textContent = "";
    status.classList.remove("err");
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
    status.classList.remove("err");
    status.textContent = "Syncing...";
    try {
      await player.sync(name);
      status.textContent = "";
      input.value = "";
      paint();
      close();
      onChange();
    } catch (e) {
      status.classList.add("err");
      status.textContent = e instanceof Error ? e.message : "Sync failed.";
    } finally {
      busy = false;
      go.disabled = false;
      input.disabled = false;
      if (status.classList.contains("err")) {
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
      eStatus.classList.add("err");
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
