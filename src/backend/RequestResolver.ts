import type { AnyRecord } from "../core/types.js";
import { PathComposer } from "../routing/PathComposer.js";
import type { HsmBackendRequest } from "./types.js";

export interface NormalizedBackendRequest {
  readonly method: string;
  readonly url: string;
}

export class RequestResolver {
  public normalize(request: HsmBackendRequest): NormalizedBackendRequest {
    const method = (request.method ?? "GET").toUpperCase();
    const url = request.originalUrl ?? request.url ?? this.composePathAndQuery(request.path ?? "/", request.query);
    return Object.freeze({ method, url });
  }

  private composePathAndQuery(pathname: string, query: AnyRecord | undefined): string {
    return PathComposer.appendSearchAndHash(pathname || "/", query);
  }
}
