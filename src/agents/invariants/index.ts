import { anonymousCannotEnter, AnonymousCannotEnterInvariant } from "./AnonymousCannotEnterInvariant.js";
import { queryCannotGrant, QueryCannotGrantInvariant } from "./QueryCannotGrantInvariant.js";
import { frontendBackendPolicyMustMatch, FrontendBackendPolicyInvariant } from "./FrontendBackendPolicyInvariant.js";
import { unsafeRedirectsNeverAccepted, UnsafeRedirectInvariant } from "./UnsafeRedirectInvariant.js";
import { viewerCannotGetOwnerPermissions, ViewerOwnerInvariant } from "./ViewerOwnerInvariant.js";
import { noUnexpectedPermissionGain, NoUnexpectedPermissionGainInvariant } from "./NoUnexpectedPermissionGainInvariant.js";

export {
  anonymousCannotEnter,
  AnonymousCannotEnterInvariant,
  queryCannotGrant,
  QueryCannotGrantInvariant,
  frontendBackendPolicyMustMatch,
  FrontendBackendPolicyInvariant,
  unsafeRedirectsNeverAccepted,
  UnsafeRedirectInvariant,
  viewerCannotGetOwnerPermissions,
  ViewerOwnerInvariant,
  noUnexpectedPermissionGain,
  NoUnexpectedPermissionGainInvariant
};

export const agentInvariants = {
  anonymousCannotEnter,
  queryCannotGrant,
  frontendBackendPolicyMustMatch,
  unsafeRedirectsNeverAccepted,
  viewerCannotGetOwnerPermissions,
  noUnexpectedPermissionGain
};
