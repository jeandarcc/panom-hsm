export { visitRoutes, VisitRoutesAction } from "./VisitRoutesAction.js";
export { tamperQuery, QueryTamperingAction } from "./QueryTamperingAction.js";
export { callBackendRoutes, BackendRouteAction } from "./BackendRouteAction.js";
export { followCanonicalAliases, CanonicalAliasAction } from "./CanonicalAliasAction.js";
export { tryPermissionBoundActions, PermissionAction } from "./PermissionAction.js";
export { tryRedirectPayloads, RedirectPayloadAction } from "./RedirectPayloadAction.js";
export { sendRandomEvent, EventAction } from "./EventAction.js";
export { runLoaders, LoaderAction } from "./LoaderAction.js";

export const agentActions = {
  visitRoutes,
  tamperQuery,
  callBackendRoutes,
  followCanonicalAliases,
  tryPermissionBoundActions,
  tryRedirectPayloads,
  sendRandomEvent,
  runLoaders
};
