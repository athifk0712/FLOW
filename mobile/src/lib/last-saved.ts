// A one-off "it's saved" message handed from Catat to the screen it returns to, for a small win after logging.
let pending: string | null = null;

export function announceSaved(message: string) {
  pending = message;
}

/** The message once (null afterwards), so it shows a single time. */
export function takeSaved() {
  const message = pending;
  pending = null;
  return message;
}
