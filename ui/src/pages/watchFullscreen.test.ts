import { describe, expect, test } from "bun:test";
import { focusReadyYouTubePlayer, toggleWatchFullscreen } from "./watchFullscreen";

function surface() {
  const calls: string[] = [];
  const body = {};
  const doc = { activeElement: body, body, documentElement: {}, fullscreenElement: null as unknown,
    exitFullscreen: async () => { calls.push("exit"); },
  };
  const fallback = { ownerDocument: doc, requestFullscreen: async () => { calls.push("page-fullscreen"); },
    contains: (element: unknown) => element === iframe,
  } as unknown as HTMLElement;
  const iframe = { ownerDocument: doc, focus: () => { calls.push("focus"); },
    requestFullscreen: async () => { calls.push("iframe-fullscreen"); },
  } as unknown as HTMLIFrameElement;
  return { calls, doc, fallback, iframe };
}

describe("watch fullscreen keyboard focus", () => {
  test("refocuses YouTube instead of opening host fullscreen without player controls", () => {
    const state = surface();
    toggleWatchFullscreen(state.fallback, state.iframe);
    expect(state.calls).toEqual(["focus"]);
  });

  test("exits existing fullscreen without refocusing or requesting it again", () => {
    const state = surface();
    state.doc.fullscreenElement = state.iframe;
    toggleWatchFullscreen(state.fallback, state.iframe);
    expect(state.calls).toEqual(["exit"]);
  });

  test("retains page fullscreen for non-YouTube surfaces", () => {
    const state = surface();
    toggleWatchFullscreen(state.fallback);
    expect(state.calls).toEqual(["page-fullscreen"]);
  });

  test("focuses a ready player when the page body or the player owns focus", () => {
    const state = surface();
    focusReadyYouTubePlayer(state.iframe, state.fallback);
    state.doc.activeElement = state.iframe;
    focusReadyYouTubePlayer(state.iframe, state.fallback);
    expect(state.calls).toEqual(["focus", "focus"]);
  });

  test("does not steal focus from another control when YouTube finishes loading", () => {
    const state = surface();
    state.doc.activeElement = { tagName: "INPUT" };
    focusReadyYouTubePlayer(state.iframe, state.fallback);
    expect(state.calls).toEqual([]);
  });
});
