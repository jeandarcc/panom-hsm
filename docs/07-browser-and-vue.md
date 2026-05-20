# HSM Browser And Vue

The browser runtime and Vue integration connect the app experience to the state tree.

## Browser Runtime

The browser runtime typically manages:

- history push/replace
- popstate
- canonical URL
- redirect safety
- host-aware navigation

That makes URL changes part of the state runtime, not only the router layer.

## Vue Integration

`@panomapp/hsm/vue` offers tools such as:

- `createHsmVue`
- `MachineOutlet`
- `useHsm`
- `useHsmState`
- `useHsmPolicy`

## MachineOutlet

`MachineOutlet` decides which view should render based on the active state.

This model can remove the need for classic `vue-router` usage.

## Composable Layer

On the Vue side, the usual needs are:

- active snapshot
- policy results
- event dispatch
- state id access

Composables provide ergonomics in those areas.

## Host-Aware Routing

In systems that use subdomains or canonical hosts, the browser runtime becomes even more valuable because host becomes part of state resolution, not just pathname.

## Next Step

[08 Backend And Schema](./08-backend-and-schema.md)
