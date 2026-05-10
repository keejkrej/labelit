import { z } from "zod";

// ---------------------------------------------------------------------------
// Base envelope — every WebSocket message has a type discriminator
// ---------------------------------------------------------------------------

export const MessageTypeSchema = z.enum([
  // Client → Server
  "label:create",
  "label:update",
  "label:delete",
  "label:list",

  // Server → Client
  "label:created",
  "label:updated",
  "label:deleted",
  "label:listed",

  // Bidirectional
  "ping",
  "pong",
  "error",
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

// ---------------------------------------------------------------------------
// Domain payloads
// ---------------------------------------------------------------------------

export const LabelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Label = z.infer<typeof LabelSchema>;

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

export const CreateLabelPayload = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type CreateLabelPayload = z.infer<typeof CreateLabelPayload>;

export const UpdateLabelPayload = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export type UpdateLabelPayload = z.infer<typeof UpdateLabelPayload>;

export const DeleteLabelPayload = z.object({
  id: z.string().uuid(),
});
export type DeleteLabelPayload = z.infer<typeof DeleteLabelPayload>;

// ---------------------------------------------------------------------------
// Generic message envelope
// ---------------------------------------------------------------------------

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("label:create"), payload: CreateLabelPayload }),
  z.object({ type: z.literal("label:update"), payload: UpdateLabelPayload }),
  z.object({ type: z.literal("label:delete"), payload: DeleteLabelPayload }),
  z.object({ type: z.literal("label:list") }),
  z.object({ type: z.literal("ping") }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("label:created"), payload: LabelSchema }),
  z.object({ type: z.literal("label:updated"), payload: LabelSchema }),
  z.object({ type: z.literal("label:deleted"), payload: z.object({ id: z.string().uuid() }) }),
  z.object({ type: z.literal("label:listed"), payload: z.array(LabelSchema) }),
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("error"), payload: z.object({ message: z.string() }) }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
