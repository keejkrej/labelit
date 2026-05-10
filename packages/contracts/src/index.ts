export {
  // Message types
  MessageTypeSchema,
  type MessageType,

  // Domain
  LabelSchema,
  type Label,

  // Client payloads
  CreateLabelPayload,
  UpdateLabelPayload,
  DeleteLabelPayload,

  // Envelopes
  ClientMessageSchema,
  type ClientMessage,
  ServerMessageSchema,
  type ServerMessage,
} from "./messages.js";
