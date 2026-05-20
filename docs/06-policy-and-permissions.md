# HSM Policy And Permissions

One of HSM's strongest pieces is the policy layer.

## What Is Policy?

Policy answers the following questions in the active state context:

- which permission the user has
- which capability can be used
- which feature is enabled
- which layout should be selected

## State-Based Resolution

A permission definition can be attached to a state or a global policy table.

```ts
policies: {
  permissions: {
    'media.delete': { guard: 'media.isOwner' }
  },
  capabilities: {
    'camera.scan': { guard: 'device.hasCamera' }
  },
  features: {
    'profile.music': { guard: 'plan.isPro' }
  }
}
```

## What Can You Call?

```ts
await hsm.can('media.delete')
await hsm.canUse('camera.scan')
await hsm.isFeatureEnabled('profile.music')
hsm.layout()
```

## Why Is It Useful?

Because it reduces scattered UI if-else logic. It also gets frontend and backend to use the same semantic terms.

## Explain Mode

```ts
await hsm.explainPermission('media.delete')
```

This helps answer the question "why not?" It is especially valuable in complex guard trees.

## Security Boundary

Important rule:

- frontend policy is UX
- backend policy is security

HSM brings both into the same semantic model without neglecting backend enforcement.

## Next Step

[07 Browser And Vue](./07-browser-and-vue.md)
