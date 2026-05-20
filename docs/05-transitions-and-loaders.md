# HSM Transitions And Loaders

Resolving a state is not the same as transitioning to it. The transition layer exists for that reason.

## What Is a Transition?

A transition:

- selects the target state
- runs guards
- executes loaders if needed
- triggers lifecycle hooks
- updates the snapshot at the end

## Lifecycle

Typical lifecycle pieces:

- `beforeEnter`
- `loader`
- `onEnter`
- `onLeave`
- event-based `on`

## Example

```ts
profile: {
  path: '/profile/:username',
  beforeEnter: 'auth.required',
  loader: 'loadProfile',
  onEnter: 'trackProfileView',
  onLeave: 'cancelProfileRequests',
  on: {
    OPEN_SETTINGS: 'app.settings'
  }
}
```

## Loaders

Loaders can be async and receive an `AbortSignal`. That lets you cancel stale requests when the user navigates quickly.

## Event-Driven Navigation

HSM can transition not only from URL changes but also from events:

```ts
send('OPEN_SETTINGS')
```

This gives UI components a more semantic integration point.

## Transition Result

```ts
const result = await hsm.transitionUrl('/profile/yusuf')
```

The result includes information such as:

- whether it succeeded
- which state it reached
- what the failure reason was

## Next Step

[06 Policy And Permissions](./06-policy-and-permissions.md)
