import type { WatchPlayerHandle } from "../playerHandle";

export interface WatchYouTubePlayer extends WatchPlayerHandle {
  loadVideoById: (target: { videoId: string; startSeconds: number }) => void;
  cueVideoById: (target: { videoId: string; startSeconds: number }) => void;
  getVideoData?: () => { video_id?: string };
}

export interface WatchYouTubeTarget {
  videoId: string;
  startSeconds: number;
  sharedStartSeconds: number;
  autoplay: boolean;
}

/** Keeps the iframe alive, including while the next route's metadata loads. */
export class WatchYouTubeSession {
  player: WatchYouTubePlayer | null = null;
  target: WatchYouTubeTarget | null = null;
  private loaded: WatchYouTubeTarget | null = null;
  private ready = false;

  update(target: WatchYouTubeTarget | null) {
    const waiting = this.target !== null && target === null;
    const resume = this.target === null && target !== null && this.ready
      && this.loaded?.videoId === target.videoId && this.loaded.sharedStartSeconds === target.sharedStartSeconds;
    this.target = target;
    if (waiting && this.ready) this.player?.pauseVideo();
    this.loadTarget();
    if (resume && target?.autoplay) this.player?.playVideo();
  }

  attach(player: WatchYouTubePlayer, initial: WatchYouTubeTarget) {
    this.player = player;
    this.loaded = initial;
  }

  onReady() {
    this.ready = true;
    if (!this.target) this.player?.pauseVideo();
    this.loadTarget();
  }

  ownsPlayback() {
    if (!this.ready || !this.target || this.loaded?.videoId !== this.target.videoId) return false;
    const actualId = this.player?.getVideoData?.().video_id;
    return !actualId || actualId === this.target.videoId;
  }

  private loadTarget() {
    const target = this.target;
    if (!this.ready || !this.player || !target) return;
    if (this.loaded?.videoId === target.videoId && this.loaded.sharedStartSeconds === target.sharedStartSeconds
      && this.loaded.autoplay === target.autoplay) return;
    this.loaded = target;
    const source = { videoId: target.videoId, startSeconds: target.startSeconds };
    if (target.autoplay) this.player.loadVideoById(source);
    else this.player.cueVideoById(source);
  }

  dispose() {
    this.ready = false;
    this.target = null;
    try { this.player?.destroy(); } catch {}
    this.player = null;
    this.loaded = null;
  }
}
