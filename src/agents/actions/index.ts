import { visitRoutes, VisitRoutesAction } from "./VisitRoutesAction.js";
import { tamperQuery, QueryTamperingAction } from "./QueryTamperingAction.js";
import { callBackendRoutes, BackendRouteAction } from "./BackendRouteAction.js";
import { followCanonicalAliases, CanonicalAliasAction } from "./CanonicalAliasAction.js";
import { tryPermissionBoundActions, PermissionAction } from "./PermissionAction.js";
import { tryRedirectPayloads, RedirectPayloadAction } from "./RedirectPayloadAction.js";
import { sendRandomEvent, EventAction } from "./EventAction.js";
import { runLoaders, LoaderAction } from "./LoaderAction.js";

export {
  visitRoutes,
  VisitRoutesAction,
  tamperQuery,
  QueryTamperingAction,
  callBackendRoutes,
  BackendRouteAction,
  followCanonicalAliases,
  CanonicalAliasAction,
  tryPermissionBoundActions,
  PermissionAction,
  tryRedirectPayloads,
  RedirectPayloadAction,
  sendRandomEvent,
  EventAction,
  runLoaders,
  LoaderAction
};

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
