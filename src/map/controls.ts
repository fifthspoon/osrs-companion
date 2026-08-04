import {
  SIZE_MAX, SIZE_MIN,
  iconsOn, labelsOn, resetSizes, setIconsOn, setLabelsOn, setSize, sizes,
} from "./prefs";
import type { SizeKey } from "./prefs";

export interface ControlOptions {
  status: string;
  picking: boolean;
  canAddMarker: boolean;
  onChange: () => void;
  onSizes: () => void;
  onRefit: () => void;
  onStartPicking: () => void;
  onCancelPicking: () => void;
}

export function controls(opts: ControlOptions): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "wmbar";

  const status = document.createElement("span");
  status.className = "note";
  status.textContent = opts.picking
    ? "Click anywhere to drop a marker. Right drag to pan."
    : opts.status;
  bar.appendChild(status);

  const btns = document.createElement("span");
  btns.className = "mapbtns";

  const mk = (text: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.className = "linkbtn";
    b.textContent = text;
    b.addEventListener("click", onClick);
    btns.appendChild(b);
  };

  const sizer = (text: string, key: SizeKey) => {
    const wrap = document.createElement("label");
    wrap.className = "wmsize";

    const name = document.createElement("span");
    name.textContent = text;
    wrap.appendChild(name);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(SIZE_MIN);
    input.max = String(SIZE_MAX);
    input.step = "0.1";
    input.value = String(sizes()[key]);

    const out = document.createElement("span");
    out.className = "wmsizeval";
    out.textContent = `${sizes()[key].toFixed(1)}x`;

    input.addEventListener("input", () => {
      const v = setSize(key, parseFloat(input.value));
      out.textContent = `${v.toFixed(1)}x`;
      opts.onSizes();
    });

    wrap.appendChild(input);
    wrap.appendChild(out);
    btns.appendChild(wrap);
  };

  if (opts.picking) {
    mk("cancel", opts.onCancelPicking);
  } else {
    mk(labelsOn() ? "labels on" : "labels off", () => {
      setLabelsOn(!labelsOn());
      opts.onChange();
    });
    mk(iconsOn() ? "map icons on" : "map icons off", () => {
      setIconsOn(!iconsOn());
      opts.onChange();
    });
    sizer("pins", "pin");
    sizer("icons", "icon");
    sizer("labels", "label");
    mk("reset sizes", () => {
      resetSizes();
      opts.onChange();
    });
    mk("reset view", opts.onRefit);
    if (opts.canAddMarker) mk("add marker", opts.onStartPicking);
  }

  bar.appendChild(btns);
  return bar;
}
