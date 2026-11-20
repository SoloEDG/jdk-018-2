export class StaleSeekError extends Error {
  constructor() {
    super("定位已被更新的请求取代");
    this.name = "StaleSeekError";
  }
}

/**
 * 包装一个视频元素，把“按时刻取帧”串行化：
 * 新的定位请求会让尚未完成的旧请求立即以 StaleSeekError 失败，
 * 因此拖动时间轴或更换视频时，旧的解码任务永远不会覆盖新画面。
 */
export class VideoSampler {
  private seq = 0;
  private pending: ((e: Error) => void) | null = null;
  constructor(
    private video: HTMLVideoElement,
    private duration: number,
  ) {}

  /** 定位到指定时刻（秒），完成后视频当前帧即为该时刻的画面。 */
  async seek(time: number): Promise<void> {
    const id = ++this.seq;
    this.failPending();
    const t = Math.min(Math.max(time, 0), this.duration);
    if (Math.abs(this.video.currentTime - t) > 1e-4) {
      this.video.currentTime = t;
      await this.waitSeeked();
    }
    if (id !== this.seq) throw new StaleSeekError();
  }

  private waitSeeked(): Promise<void> {
    return new Promise((resolve, reject) => {
      const video = this.video;
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
        if (this.pending === fail) this.pending = null;
      };
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const fail = (e: Error) => {
        cleanup();
        reject(e);
      };
      const timer = setTimeout(() => fail(new Error("视频定位超时")), 8000);
      this.pending = fail;
      video.addEventListener("seeked", onSeeked);
    });
  }

  private failPending() {
    const p = this.pending;
    this.pending = null;
    p?.(new StaleSeekError());
  }

  /** 释放：让在途请求立即失败，之后所有定位都视为过期。 */
  dispose() {
    this.seq++;
    this.failPending();
  }
}
