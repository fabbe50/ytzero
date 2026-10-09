import { describe, expect, test } from "bun:test";
import { WatchYouTubeSession, type WatchYouTubePlayer, type WatchYouTubeTarget } from "./watchYouTubeSession";

const target = (videoId: string, extra: Partial<WatchYouTubeTarget> = {}): WatchYouTubeTarget => ({
  videoId, startSeconds: 0, sharedStartSeconds: 0, autoplay: true, ...extra,
});

function player() {
  const calls: { action: string; value?: unknown }[] = [];
  let actualId = "first";
  const handle = {
    pauseVideo: () => calls.push({ action: "pause" }),
    playVideo: () => calls.push({ action: "play" }),
    destroy: () => calls.push({ action: "destroy" }),
    loadVideoById: (value: unknown) => calls.push({ action: "load", value }),
    cueVideoById: (value: unknown) => calls.push({ action: "cue", value }),
    getVideoData: () => ({ video_id: actualId }),
  } as unknown as WatchYouTubePlayer;
  return { handle, calls, playing: (id: string) => { actualId = id; } };
}

describe("watch YouTube iframe ownership", () => {
  test("keeps the same player through a route loading gap and resumes the next video", () => {
    const session = new WatchYouTubeSession();
    const p = player();
    session.update(target("first"));
    session.attach(p.handle, target("first"));
    session.onReady();
    session.update(null);
    expect(session.player).toBe(p.handle);
    expect(session.ownsPlayback()).toBe(false);
    session.update(target("second", { startSeconds: 42 }));
    expect(session.player).toBe(p.handle);
    expect(p.calls).toEqual([
      { action: "pause" },
      { action: "load", value: { videoId: "second", startSeconds: 42 } },
    ]);
    expect(session.ownsPlayback()).toBe(false);
    p.playing("second");
    expect(session.ownsPlayback()).toBe(true);
  });

  test("loads the latest route if navigation happens before YouTube is ready", () => {
    const session = new WatchYouTubeSession();
    const p = player();
    session.update(target("first"));
    session.attach(p.handle, target("first"));
    session.update(target("second"));
    session.update(target("third", { startSeconds: 7 }));
    expect(p.calls).toEqual([]);
    session.onReady();
    expect(p.calls).toEqual([{ action: "load", value: { videoId: "third", startSeconds: 7 } }]);
  });

  test("does not restart a video when its metadata or polled position changes", () => {
    const session = new WatchYouTubeSession();
    const p = player();
    session.update(target("first"));
    session.attach(p.handle, target("first"));
    session.onReady();
    session.update(target("first", { startSeconds: 85 }));
    expect(p.calls).toEqual([]);
    session.update(target("first", { startSeconds: 30, sharedStartSeconds: 30 }));
    expect(p.calls).toEqual([{ action: "load", value: { videoId: "first", startSeconds: 30 } }]);
  });

  test("cues a watch-together video without starting it and releases the player on exit", () => {
    const session = new WatchYouTubeSession();
    const p = player();
    session.update(target("first"));
    session.attach(p.handle, target("first"));
    session.onReady();
    session.update(target("room", { autoplay: false, startSeconds: 12 }));
    expect(p.calls).toEqual([{ action: "cue", value: { videoId: "room", startSeconds: 12 } }]);
    session.dispose();
    expect(p.calls[p.calls.length - 1]).toEqual({ action: "destroy" });
    expect(session.player).toBe(null);
    expect(session.ownsPlayback()).toBe(false);
  });

  test("pauses a player that becomes ready while the route is still loading", () => {
    const session = new WatchYouTubeSession();
    const p = player();
    session.update(target("first"));
    session.attach(p.handle, target("first"));
    session.update(null);
    session.onReady();
    expect(p.calls).toEqual([{ action: "pause" }]);
    expect(session.ownsPlayback()).toBe(false);
  });

  test("resumes without reloading if metadata temporarily disappears for the same video", () => {
    const session = new WatchYouTubeSession();
    const p = player();
    session.update(target("first"));
    session.attach(p.handle, target("first"));
    session.onReady();
    session.update(null);
    session.update(target("first"));
    expect(p.calls).toEqual([{ action: "pause" }, { action: "play" }]);
  });
});
