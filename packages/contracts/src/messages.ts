import { z } from "zod";

// ---------------------------------------------------------------------------
// Base envelope — every WebSocket message has a type discriminator
// ---------------------------------------------------------------------------

export const MessageTypeSchema = z.enum([
  // Filesystem (client → server)
  "fs:list_roots",
  "fs:list_dir",
  "fs:home",
  // Filesystem (server → client)
  "fs:roots_listed",
  "fs:dir_listed",
  "fs:home_resolved",

  // Image IO (client → server)
  "image:open",
  "image:open_masks",
  "image:save_masks",
  "image:save_outlines",
  "image:save_rois",
  "image:save_flows",
  "image:save_seg",
  // Image IO (server → client)
  "image:opened",
  "image:saved",

  // Mask editing (client → server)
  "mask:stroke",
  "mask:stroke_begin",
  "mask:stroke_append",
  "mask:stroke_end",
  "mask:remove_at",
  "mask:remove_at_points",
  "mask:remove_in_region",
  "mask:merge_at",
  "mask:clear",
  "mask:undo",
  "mask:redo",
  "mask:request",
  // Mask editing (server → client)
  "mask:updated",

  // Models (client → server)
  "model:list",
  "model:run",
  "model:train",
  // Models (server → client)
  "model:listed",
  "model:progress",
  "model:run_done",
  "model:train_done",

  // Bidirectional
  "ping",
  "pong",
  "error",
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

export const FsEntryKindSchema = z.enum(["dir", "file", "drive"]);
export type FsEntryKind = z.infer<typeof FsEntryKindSchema>;

export const FsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: FsEntryKindSchema,
  size: z.number().int().nonnegative().nullable().optional(),
  modifiedAt: z.string().nullable().optional(),
});
export type FsEntry = z.infer<typeof FsEntrySchema>;

export const ListDirPayload = z.object({
  path: z.string(),
  // glob filter applied to file names (case-insensitive). Directories always pass.
  patterns: z.array(z.string()).optional(),
});
export type ListDirPayload = z.infer<typeof ListDirPayload>;

export const DirListedPayload = z.object({
  path: z.string(),
  parent: z.string().nullable(),
  entries: z.array(FsEntrySchema),
});
export type DirListedPayload = z.infer<typeof DirListedPayload>;

export const RootsListedPayload = z.object({
  platform: z.enum(["windows", "darwin", "linux"]),
  roots: z.array(FsEntrySchema),
});
export type RootsListedPayload = z.infer<typeof RootsListedPayload>;

export const HomeResolvedPayload = z.object({
  path: z.string(),
});
export type HomeResolvedPayload = z.infer<typeof HomeResolvedPayload>;

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const OpenImagePayload = z.object({
  path: z.string(),
});
export type OpenImagePayload = z.infer<typeof OpenImagePayload>;

export const OpenMasksPayload = z.object({
  path: z.string(),
  imagePath: z.string(),
});
export type OpenMasksPayload = z.infer<typeof OpenMasksPayload>;

export const ImageMetaSchema = z.object({
  path: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  channels: z.number().int().positive(),
  depth: z.number().int().positive(),
  dtype: z.string(),
  // base64-encoded preview (PNG) for fast display; raw pixels are kept server-side
  previewPng: z.string().optional(),
});
export type ImageMeta = z.infer<typeof ImageMetaSchema>;

export const SavePathPayload = z.object({
  path: z.string().optional(),
});
export type SavePathPayload = z.infer<typeof SavePathPayload>;

export const SavedPayload = z.object({
  path: z.string(),
});
export type SavedPayload = z.infer<typeof SavedPayload>;

// ---------------------------------------------------------------------------
// Mask editing — original-image-pixel coordinates throughout.
// ---------------------------------------------------------------------------

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof PointSchema>;

export const StrokePayload = z.object({
  points: z.array(PointSchema).min(1),
  radius: z.number().int().positive(),
  /** When true, paints background (0) — i.e. eraser. */
  erase: z.boolean().optional(),
});
export type StrokePayload = z.infer<typeof StrokePayload>;

export const RemoveAtPayload = z.object({
  x: z.number(),
  y: z.number(),
});
export type RemoveAtPayload = z.infer<typeof RemoveAtPayload>;

export const MaskStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  nRois: z.number().int().nonnegative(),
  previewPng: z.string().nullable().optional(),
  outlinesPng: z.string().nullable().optional(),
  canUndo: z.boolean(),
  canRedo: z.boolean(),
});
export type MaskState = z.infer<typeof MaskStateSchema>;

// Streaming strokes — begin opens a new ROI label and snapshots history; append
// adds segments without snapshotting; end finalises. erase mode paints 0.
export const StrokeBeginPayload = z.object({
  point: PointSchema,
  radius: z.number().int().positive(),
  erase: z.boolean().optional(),
});
export type StrokeBeginPayload = z.infer<typeof StrokeBeginPayload>;

export const StrokeAppendPayload = z.object({
  points: z.array(PointSchema).min(1),
});
export type StrokeAppendPayload = z.infer<typeof StrokeAppendPayload>;

// Batch delete via a list of clicked pixels (one undo step for all).
export const RemoveAtPointsPayload = z.object({
  points: z.array(PointSchema).min(1),
});
export type RemoveAtPointsPayload = z.infer<typeof RemoveAtPointsPayload>;

// Polygon region: ROI labels touching the rasterised polygon are removed.
export const RemoveInRegionPayload = z.object({
  polygon: z.array(PointSchema).min(3),
});
export type RemoveInRegionPayload = z.infer<typeof RemoveInRegionPayload>;

// Merge two ROIs by clicking one pixel inside each.
export const MergeAtPayload = z.object({
  a: PointSchema,
  b: PointSchema,
});
export type MergeAtPayload = z.infer<typeof MergeAtPayload>;

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const ModelInfoSchema = z.object({
  name: z.string(),
  // "builtin" → shipped with cellpose; "custom" → user-trained
  source: z.enum(["builtin", "custom"]),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const RunModelPayload = z.object({
  model: z.string(),
  imagePath: z.string(),
  diameter: z.number().nullable().optional(),
  flowThreshold: z.number().optional(),
  cellprobThreshold: z.number().optional(),
  niter: z.number().int().nonnegative().optional(),
  minSize: z.number().int().nonnegative().optional(),
  anisotropy: z.number().optional(),
  useGpu: z.boolean().optional(),
});
export type RunModelPayload = z.infer<typeof RunModelPayload>;

export const TrainModelPayload = z.object({
  baseModel: z.string(),
  trainDir: z.string(),
  modelName: z.string(),
  nEpochs: z.number().int().positive().optional(),
  learningRate: z.number().positive().optional(),
  weightDecay: z.number().nonnegative().optional(),
  batchSize: z.number().int().positive().optional(),
  useGpu: z.boolean().optional(),
});
export type TrainModelPayload = z.infer<typeof TrainModelPayload>;

export const ProgressPayload = z.object({
  job: z.enum(["run", "train"]),
  progress: z.number().min(0).max(1),
  message: z.string().optional(),
});
export type ProgressPayload = z.infer<typeof ProgressPayload>;

export const RunDonePayload = z.object({
  imagePath: z.string(),
  nRois: z.number().int().nonnegative(),
  // server-side path to autosaved _seg.npy (cellpose convention)
  segPath: z.string().nullable(),
});
export type RunDonePayload = z.infer<typeof RunDonePayload>;

export const TrainDonePayload = z.object({
  modelName: z.string(),
  modelPath: z.string(),
});
export type TrainDonePayload = z.infer<typeof TrainDonePayload>;

// ---------------------------------------------------------------------------
// Generic message envelope
// ---------------------------------------------------------------------------

export const ClientMessageSchema = z.discriminatedUnion("type", [
  // fs
  z.object({ type: z.literal("fs:list_roots") }),
  z.object({ type: z.literal("fs:list_dir"), payload: ListDirPayload }),
  z.object({ type: z.literal("fs:home") }),
  // image
  z.object({ type: z.literal("image:open"), payload: OpenImagePayload }),
  z.object({ type: z.literal("image:open_masks"), payload: OpenMasksPayload }),
  z.object({ type: z.literal("image:save_masks"), payload: SavePathPayload }),
  z.object({ type: z.literal("image:save_outlines"), payload: SavePathPayload }),
  z.object({ type: z.literal("image:save_rois"), payload: SavePathPayload }),
  z.object({ type: z.literal("image:save_flows"), payload: SavePathPayload }),
  z.object({ type: z.literal("image:save_seg"), payload: SavePathPayload }),
  // mask edits
  z.object({ type: z.literal("mask:stroke"), payload: StrokePayload }),
  z.object({ type: z.literal("mask:stroke_begin"), payload: StrokeBeginPayload }),
  z.object({ type: z.literal("mask:stroke_append"), payload: StrokeAppendPayload }),
  z.object({ type: z.literal("mask:stroke_end") }),
  z.object({ type: z.literal("mask:remove_at"), payload: RemoveAtPayload }),
  z.object({ type: z.literal("mask:remove_at_points"), payload: RemoveAtPointsPayload }),
  z.object({ type: z.literal("mask:remove_in_region"), payload: RemoveInRegionPayload }),
  z.object({ type: z.literal("mask:merge_at"), payload: MergeAtPayload }),
  z.object({ type: z.literal("mask:clear") }),
  z.object({ type: z.literal("mask:undo") }),
  z.object({ type: z.literal("mask:redo") }),
  z.object({ type: z.literal("mask:request") }),
  // model
  z.object({ type: z.literal("model:list") }),
  z.object({ type: z.literal("model:run"), payload: RunModelPayload }),
  z.object({ type: z.literal("model:train"), payload: TrainModelPayload }),
  // misc
  z.object({ type: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  // fs
  z.object({ type: z.literal("fs:roots_listed"), payload: RootsListedPayload }),
  z.object({ type: z.literal("fs:dir_listed"), payload: DirListedPayload }),
  z.object({ type: z.literal("fs:home_resolved"), payload: HomeResolvedPayload }),
  // image
  z.object({ type: z.literal("image:opened"), payload: ImageMetaSchema }),
  z.object({ type: z.literal("image:saved"), payload: SavedPayload }),
  // mask state
  z.object({ type: z.literal("mask:updated"), payload: MaskStateSchema }),
  // model
  z.object({ type: z.literal("model:listed"), payload: z.array(ModelInfoSchema) }),
  z.object({ type: z.literal("model:progress"), payload: ProgressPayload }),
  z.object({ type: z.literal("model:run_done"), payload: RunDonePayload }),
  z.object({ type: z.literal("model:train_done"), payload: TrainDonePayload }),
  // misc
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("error"), payload: z.object({ message: z.string() }) }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
