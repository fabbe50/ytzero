import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { WatchPlayerHandle } from "../playerHandle";
import { captionPlayerVars } from "./watchCaptions";
import { loadYouTubeApi } from "./watchRuntime";
import { focusReadyYouTubePlayer } from "./watchFullscreen";
import { WatchYouTubeSession, type WatchYouTubePlayer, type WatchYouTubeTarget } from "./watchYouTubeSession";

export function useWatchYouTubePlayer(options: {
  enabled: boolean;
  target: WatchYouTubeTarget | null;
  wrapRef: RefObject<HTMLDivElement>;
  playerRef: MutableRefObject<WatchPlayerHandle | null>;
  title: string;
  language?: string;
  quality?: string;
  speed: number;
  captionsOn: boolean;
  captionsLanguage: string;
  captionsOff: boolean;
  transportLocked: boolean;
  requestPlayback: () => void;
  onEnded: () => void;
  onError: (code: number | null) => void;
  onAutoplayBlocked: () => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const sessionRef = useRef<WatchYouTubeSession | null>(null);
  const ensurePlayerRef = useRef<() => void>(() => {});
  const applyPreferencesRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!options.enabled) return;
    const wrap = options.wrapRef.current;
    if (!wrap) return;
    const session = new WatchYouTubeSession();
    sessionRef.current = session;
    let creating = false;
    let disposed = false;
    let speedApplied = false;

    const focusFullscreenPlayer = () => {
      const iframe = session.player?.getIframe?.();
      if (iframe && document.fullscreenElement === iframe) iframe.focus({ preventScroll: true });
    };
    document.addEventListener("fullscreenchange", focusFullscreenPlayer);

    const applyPreferences = () => {
      const player = session.player;
      if (!player) return;
      const current = latest.current;
      player.getIframe?.().setAttribute("aria-label", current.title);
      if (current.captionsOff || !current.captionsOn) player.unloadModule?.("captions");
      else {
        player.loadModule?.("captions");
        player.setOption?.("captions", "track", { languageCode: current.captionsLanguage });
      }
    };
    applyPreferencesRef.current = applyPreferences;

    ensurePlayerRef.current = () => {
      if (creating || session.player || !session.target) return;
      creating = true;
      void loadYouTubeApi().then(() => {
        if (disposed || !session.target) { creating = false; return; }
        const initial = session.target;
        const current = latest.current;
        const inner = document.createElement("div");
        wrap.appendChild(inner);
        const playerVars: Record<string, unknown> = {
          autoplay: initial.autoplay ? 1 : 0, controls: 1, rel: 0,
          iv_load_policy: 3, playsinline: 1, origin: window.location.origin,
          ...captionPlayerVars(current.captionsOn, current.captionsLanguage),
        };
        if (initial.startSeconds > 0) playerVars.start = initial.startSeconds;
        if (current.language) playerVars.hl = current.language;
        if (current.quality && current.quality !== "auto") playerVars.vq = current.quality;
        const player: WatchYouTubePlayer = new (window as any).YT.Player(inner, {
          host: "https://www.youtube-nocookie.com", videoId: initial.videoId,
          width: "100%", height: "100%", playerVars,
          events: {
            onReady: () => {
              if (disposed) return;
              session.onReady();
              const iframe = player.getIframe?.();
              iframe?.removeAttribute("title");
              if (latest.current.transportLocked && iframe) iframe.tabIndex = -1;
              else if (iframe) focusReadyYouTubePlayer(iframe, wrap);
              applyPreferences();
              try { player.setPlaybackRate(latest.current.speed); } catch {}
              if (session.target?.autoplay) latest.current.requestPlayback();
            },
            onApiChange: () => {
              if (!disposed && session.ownsPlayback() && latest.current.captionsOn && !latest.current.captionsOff) {
                player.setOption?.("captions", "track", { languageCode: latest.current.captionsLanguage });
              }
            },
            onAutoplayBlocked: () => { if (!disposed && session.target) latest.current.onAutoplayBlocked(); },
            onStateChange: (event: { data: number }) => {
              if (disposed || !session.ownsPlayback()) return;
              if (event.data === 1) {
                if (!speedApplied) {
                  try { player.setPlaybackRate(latest.current.speed); } catch {}
                  applyPreferences();
                  speedApplied = true;
                }
              } else speedApplied = false;
              try {
                if ("mediaSession" in navigator) navigator.mediaSession.playbackState = event.data === 1 ? "playing" : event.data === 2 ? "paused" : "none";
              } catch {}
              if (event.data === 0 && !latest.current.transportLocked) latest.current.onEnded();
            },
            onError: (event: { data: number }) => {
              if (!disposed && session.target) latest.current.onError(Number(event.data) || null);
            },
          },
        });
        session.attach(player, initial);
        options.playerRef.current = player;
      }).catch(() => {
        creating = false;
        if (!disposed) latest.current.onError(null);
      });
    };
    return () => {
      disposed = true;
      document.removeEventListener("fullscreenchange", focusFullscreenPlayer);
      const player = session.player;
      session.dispose();
      if (options.playerRef.current === player) options.playerRef.current = null;
      wrap.replaceChildren();
      if (sessionRef.current === session) sessionRef.current = null;
      ensurePlayerRef.current = () => {};
      applyPreferencesRef.current = () => {};
    };
  }, [options.enabled, options.playerRef, options.wrapRef]);

  useEffect(() => {
    sessionRef.current?.update(options.target);
    ensurePlayerRef.current();
    const iframe = sessionRef.current?.player?.getIframe?.();
    if (iframe) {
      iframe.setAttribute("aria-label", options.title);
      if (options.transportLocked) iframe.tabIndex = -1;
      else iframe.removeAttribute("tabindex");
    }
  }, [options.enabled, options.target?.videoId, options.target?.sharedStartSeconds, options.target?.autoplay, options.title, options.transportLocked]);

  useEffect(() => {
    if (sessionRef.current?.ownsPlayback()) applyPreferencesRef.current();
  }, [options.captionsOn, options.captionsLanguage, options.captionsOff]);
}
