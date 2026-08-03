// Desktop notifications for tasks coming ready.
//
// Deliberately quiet: only short-loop tasks (birdhouse, herb, seaweed) fire a
// notification. Getting pinged that your hardwood trees are ready after three
// days is noise, and noise is how a tool like this gets muted and then ignored.

const NOTIFY_IDS = new Set(["birdhouse", "herb", "seaweed"]);

// Tasks we've already notified about, cleared when they're marked done again.
const notified = new Set<string>();

export function canNotify(): boolean {
  return typeof Notification !== "undefined";
}

export function permission(): NotificationPermission | "unsupported" {
  return canNotify() ? Notification.permission : "unsupported";
}

export async function requestPermission(): Promise<void> {
  if (!canNotify() || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // User dismissed. The app still works, it just stays passive.
  }
}

export function shouldNotifyFor(id: string): boolean {
  return NOTIFY_IDS.has(id);
}

export function fire(id: string, name: string): void {
  if (!shouldNotifyFor(id)) return;
  if (notified.has(id)) return; // already told you, don't nag
  notified.add(id);
  if (!canNotify() || Notification.permission !== "granted") return;
  try {
    new Notification("OSRS Companion", {
      body: `${name} is ready`,
      tag: id, // replaces rather than stacks if one is still on screen
    });
  } catch {
    // Some browsers throw when constructing outside a user gesture. Ignore.
  }
}

// Called when a task is marked done so it can notify again next cycle.
export function clear(id: string): void {
  notified.delete(id);
}
