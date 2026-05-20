import { openRedirect, OpenRedirectProbe } from "./OpenRedirectProbe.js";
import { unauthenticatedAccess, UnauthenticatedAccessProbe } from "./UnauthenticatedAccessProbe.js";
import { permissionEscalation, PermissionEscalationProbe } from "./PermissionEscalationProbe.js";
import { queryTampering, QueryTamperingProbe } from "./QueryTamperingProbe.js";
import { backendPolicyMismatch, BackendPolicyMismatchProbe } from "./BackendPolicyMismatchProbe.js";
import { routeCanonicalization, RouteCanonicalizationProbe } from "./RouteCanonicalizationProbe.js";
import { hiddenRoute, HiddenRouteProbe } from "./HiddenRouteProbe.js";
import { backendMethodPolicy, BackendMethodPolicyProbe } from "./BackendMethodPolicyProbe.js";
import { querySchema, QuerySchemaProbe } from "./QuerySchemaProbe.js";

export const probes = {
  openRedirect,
  unauthenticatedAccess,
  permissionEscalation,
  queryTampering,
  backendPolicyMismatch,
  routeCanonicalization,
  hiddenRoute,
  backendMethodPolicy,
  querySchema,
  defaultAudit(): readonly [
    OpenRedirectProbe,
    UnauthenticatedAccessProbe,
    QueryTamperingProbe,
    PermissionEscalationProbe,
    BackendPolicyMismatchProbe,
    RouteCanonicalizationProbe,
    HiddenRouteProbe,
    BackendMethodPolicyProbe,
    QuerySchemaProbe
  ] {
    return [
      openRedirect(),
      unauthenticatedAccess({ protectedStates: [] }),
      queryTampering(),
      permissionEscalation(),
      backendPolicyMismatch(),
      routeCanonicalization(),
      hiddenRoute(),
      backendMethodPolicy(),
      querySchema()
    ];
  }
};

export {
  OpenRedirectProbe,
  UnauthenticatedAccessProbe,
  PermissionEscalationProbe,
  QueryTamperingProbe,
  BackendPolicyMismatchProbe,
  RouteCanonicalizationProbe,
  HiddenRouteProbe,
  BackendMethodPolicyProbe,
  QuerySchemaProbe
};
