/** Whether this browser can show system notifications at all. */
export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

/** Asks for permission if it hasn't been decided yet. */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Whether the person is looking at something else: another tab, another
 * app, or a minimised window.
 */
export function appIsInBackground() {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden" || !document.hasFocus();
}

/**
 * Shows a system notification. Notifications with the same tag replace each
 * other, so several open tabs show only one, and `renotify` makes a
 * replacement alert again. Clicking it brings the app forward.
 */
export function showNotification(
  title: string,
  body: string,
  tag: string,
  options: { silent?: boolean } = {},
) {
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return false;
  }
  try {
    const notification = new Notification(title, {
      body,
      tag,
      silent: options.silent ?? false,
      renotify: true,
    } as NotificationOptions);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
