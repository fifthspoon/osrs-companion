import { allocate } from "./allocate";
import type { Allocation, Slot, UnusedReason } from "./allocate";
import type { Candidate } from "./flip";
import type { Settings } from "./settings";
import { gp, count, duration } from "./fmt";

export function renderBasic(
  candidates: Candidate[],
  s: Settings,
  rerender: () => void,
): HTMLElement {
  const plan = allocate(candidates, {
    capital: s.capital,
    slotCount: s.slots,
    minProfit: s.minSlotProfit,
    checkInHours: s.checkInHours,
  });

  const wrap = document.createElement("section");
  wrap.className = "mkplan";

  if (!plan.slots.length) {
    wrap.appendChild(empty(plan, rerender));
    return wrap;
  }

  wrap.appendChild(headline(plan));

  const list = document.createElement("ol");
  list.className = "mkslots";
  plan.slots.forEach((slot, i) => list.appendChild(slotRow(slot, i + 1)));
  wrap.appendChild(list);

  wrap.appendChild(summary(plan));

  return wrap;
}

function headline(plan: Allocation): HTMLElement {
  const c = document.createElement("div");
  c.className = "card ready mktop";

  const left = document.createElement("div");
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = `${gp(plan.committed)} across ${plan.slots.length} slot${plan.slots.length === 1 ? "" : "s"}`;
  const note = document.createElement("div");
  note.className = "note";
  note.textContent =
    `Sized for a ${duration(plan.checkInHours)} check in, capped by each item's 4 hour buy limit ` +
    `and by how fast it actually trades. Profit shown is one round of offers.`;
  left.append(name, note);

  const right = document.createElement("div");
  right.className = "mkprofit";
  const num = document.createElement("div");
  num.className = "mkpnum";
  num.textContent = `+${gp(plan.profit)}`;
  const sub = document.createElement("div");
  sub.className = "note";
  sub.textContent = `${gp(plan.profitPerHour)} per hour`;
  right.append(num, sub);

  c.append(left, right);
  return c;
}

function slotRow(slot: Slot, n: number): HTMLElement {
  const { candidate: c, sized: z } = slot;

  const li = document.createElement("li");
  li.className = "mkslot";

  const idx = document.createElement("span");
  idx.className = "mkslotn";
  idx.textContent = String(n);

  const main = document.createElement("div");
  main.className = "mkslotmain";

  const title = document.createElement("div");
  title.className = "mkslotname";
  title.textContent = c.name;
  const qty = document.createElement("span");
  qty.className = "mkqty";
  qty.textContent = `x${count(z.qty)}`;
  title.appendChild(qty);

  const line1 = document.createElement("div");
  line1.className = "note";
  line1.textContent = `Buy ${count(c.buy)}, sell ${count(c.sell)}. ${gp(z.spend)} in, ${gp(c.net)} each after ${gp(c.tax)} tax.`;

  const line2 = document.createElement("div");
  line2.className = "note";
  line2.textContent =
    z.bound === "limit"
      ? `Held back by the ${count(c.limit)} buy limit, so this pays out once per 4 hours.`
      : z.bound === "capital"
        ? `Held back by your bank. More gp would buy more of this.`
        : `Held back by how fast it trades. Both legs fill in ${duration(z.cycleHours)}.`;

  main.append(title, line1, line2);

  const right = document.createElement("div");
  right.className = "mkslotprofit";
  const p = document.createElement("div");
  p.className = "mkslotp";
  p.textContent = `+${gp(z.profit)}`;
  const rate = document.createElement("div");
  rate.className = "note";
  rate.textContent = `${gp(z.profitPerHour)}/hr`;
  right.append(p, rate);

  li.append(idx, main, right);
  return li;
}

function summary(plan: Allocation): HTMLElement {
  const p = document.createElement("p");
  p.className = "note mksummary";

  const parts = [
    `Committing ${gp(plan.committed)} of ${gp(plan.capital)}.`,
  ];

  const idle = plan.slotCount - plan.slots.length;
  if (idle > 0) parts.push(`${idle} slot${idle === 1 ? "" : "s"} left empty: ${reasonText(plan.unused, plan)}`);
  else if (plan.remaining > 0) parts.push(`${gp(plan.remaining)} uncommitted.`);

  p.textContent = parts.join(" ");
  return p;
}

function reasonText(r: UnusedReason, plan: Allocation): string {
  if (r === "capital-exhausted") {
    return `${gp(plan.remaining)} left over is not enough for a single unit of anything else that qualifies.`;
  }
  if (r === "all-taken") {
    return `only ${plan.poolSize} item${plan.poolSize === 1 ? "" : "s"} cleared the gates and all of them are already placed.`;
  }
  if (r === "below-floor") {
    return `${gp(plan.remaining)} left over buys nothing worth more than ${gp(plan.minProfit)} of profit, which is not worth a slot. Lower the minimum below if you disagree.`;
  }
  return "nothing else cleared the gates. Loosen them below.";
}

function empty(plan: Allocation, rerender: () => void): HTMLElement {
  const c = document.createElement("div");
  c.className = "card idle";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = "No flip is worth placing right now";

  const note = document.createElement("div");
  note.className = "note";
  note.textContent =
    plan.poolSize === 0
      ? "Nothing cleared the gates. Loosen them below, or wait for the market to move."
      : `${plan.poolSize} items cleared the gates but ${gp(plan.capital)} does not cover a single unit of any of them. Raise your bank, or loosen the gates to let cheaper items through.`;

  const retry = document.createElement("button");
  retry.className = "linkbtn";
  retry.textContent = "recheck";
  retry.addEventListener("click", () => rerender());

  c.append(name, note, retry);
  return c;
}
