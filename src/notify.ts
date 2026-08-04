
const NOTIFY_IDS = new Set(["birdhouse", "herb", "seaweed"]);

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
  }
}

export function clear(id: string): void {
  notified.delete(id);
}
