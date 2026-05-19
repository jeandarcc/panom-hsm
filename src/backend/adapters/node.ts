import type { HsmBackendRequest } from "../types.js";

export interface NodeLikeIncomingMessage {
  readonly method?: string;
  readonly url?: string;
  readonly headers?: Record<string, string | readonly string[] | undefined>;
  readonly [key: string]: unknown;
}

export function fromNodeRequest(request: NodeLikeIncomingMessage): HsmBackendRequest {
  const output: HsmBackendRequest = {};
  if (request.method !== undefined) Object.assign(output, { method: request.method });
  if (request.url !== undefined) Object.assign(output, { url: request.url });
  if (request.headers !== undefined) Object.assign(output, { headers: request.headers });
  return output;
}
