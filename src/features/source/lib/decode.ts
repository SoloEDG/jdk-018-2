import type { Asset } from "../../../shared/document";
export async function decodeImage(url: string, name: string): Promise<Asset> {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (
    !image.naturalWidth ||
    image.naturalWidth * image.naturalHeight > 40000000
  )
    throw new Error("图片超过 4000 万像素，请先缩小");
  if (url.startsWith("blob:")) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    url = canvas.toDataURL("image/png");
  }
  return {
    kind: "image",
    name,
    url,
    width: image.naturalWidth,
    height: image.naturalHeight,
    image,
    duration: 0,
  };
}

function waitSeeked(video: HTMLVideoElement, timeout = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("视频定位超时"));
    }, timeout);
    video.addEventListener("seeked", onSeeked);
  });
}

/** 部分 WebM 缺少时长元数据：定位到极大时刻，让浏览器解析出真实时长。 */
async function probeDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration)) return video.duration;
  try {
    video.currentTime = Number.MAX_SAFE_INTEGER;
    await waitSeeked(video, 4000);
  } catch {
    /* 忽略，下面统一校验 */
  }
  return video.duration;
}

export async function decodeVideo(url: string, name: string): Promise<Asset> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", ok);
      video.removeEventListener("error", bad);
    };
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error("无法解码该视频，请尝试 MP4 (H.264) 或 WebM"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("视频读取超时"));
    }, 15000);
    video.addEventListener("loadedmetadata", ok);
    video.addEventListener("error", bad);
  });
  if (!video.videoWidth || !video.videoHeight)
    throw new Error("视频没有可显示的画面");
  const duration = await probeDuration(video);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("无法确定视频时长，请转换为 MP4 后重试");
  if (video.currentTime > 1e-4) {
    video.currentTime = 0;
    await waitSeeked(video);
  }
  return {
    kind: "video",
    name,
    url,
    width: video.videoWidth,
    height: video.videoHeight,
    image: video,
    duration,
    release: () => {
      video.removeAttribute("src");
      video.load();
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    },
  };
}
