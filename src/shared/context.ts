import type { InjectionKey, Ref } from "vue";
import type { StudioDocument } from "./document";
import type { VideoSession } from "../features/video/model/session";
export interface StudioContext {
  doc: StudioDocument;
  busy: Ref<boolean>;
  notice: Ref<string>;
  invalidate: () => void;
  video: VideoSession;
}
export const studioKey: InjectionKey<StudioContext> = Symbol("studio");
