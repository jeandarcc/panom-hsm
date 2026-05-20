export { anonymousCannotEnter, AnonymousCannotEnterInvariant } from "./AnonymousCannotEnterInvariant.js";
export { queryCannotGrant, QueryCannotGrantInvariant } from "./QueryCannotGrantInvariant.js";
export { frontendBackendPolicyMustMatch, FrontendBackendPolicyInvariant } from "./FrontendBackendPolicyInvariant.js";
export { unsafeRedirectsNeverAccepted, UnsafeRedirectInvariant } from "./UnsafeRedirectInvariant.js";
export { viewerCannotGetOwnerPermissions, ViewerOwnerInvariant } from "./ViewerOwnerInvariant.js";
export { noUnexpectedPermissionGain, NoUnexpectedPermissionGainInvariant } from "./NoUnexpectedPermissionGainInvariant.js";

export const agentInvariants = {
  anonymousCannotEnter,
  queryCannotGrant,
  frontendBackendPolicyMustMatch,
  unsafeRedirectsNeverAccepted,
  viewerCannotGetOwnerPermissions,
  noUnexpectedPermissionGain
};
