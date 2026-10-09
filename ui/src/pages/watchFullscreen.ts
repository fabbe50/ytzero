/** Request fullscreen synchronously, while the key/button gesture is active. */
export function toggleWatchFullscreen(fallback: HTMLElement, iframe?: HTMLIFrameElement) {
  const doc = fallback.ownerDocument;
  if (doc.fullscreenElement) {
    void doc.exitFullscreen?.().catch(() => {});
    return;
  }
  if (iframe) {
    // YouTube's native F handler lives inside the cross-origin document.
    // An outer requestFullscreen() bypasses its fullscreen controls. If focus
    // has left the player, return it rather than opening that incomplete view.
    iframe.focus({ preventScroll: true });
    return;
  }
  void fallback.requestFullscreen?.().catch(() => {});
}

/** Delayed player readiness must not steal focus from another page control. */
export function focusReadyYouTubePlayer(iframe: HTMLIFrameElement, container: HTMLElement) {
  const doc = iframe.ownerDocument;
  const active = doc.activeElement;
  if (active && active !== doc.body && active !== doc.documentElement && !container.contains(active)) return;
  iframe.focus({ preventScroll: true });
}
