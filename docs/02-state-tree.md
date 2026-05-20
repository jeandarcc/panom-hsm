# HSM State Tree

The state tree is the heart of HSM.

## What Is the State Tree?

It is a semantic application map made of nested state definitions.

```ts
states: {
  landing: {
    path: '/'
  },
  app: {
    path: '/app',
    url: { hide: true },
    states: {
      profile: {
        path: '/profile/:username',
        states: {
          owner: {},
          viewer: {}
        }
      }
    }
  }
}
```

In this model:

- `app` is the parent
- `profile` is its child state
- `owner` and `viewer` are more specific child states

## Inheritance

Child states inherit some behavior from parent states:

- layout
- permission
- capability
- feature
- path semantics

This reduces repetitive config.

## State ID

A state id is the semantic path of the node:

- `app`
- `app.profile`
- `app.profile.owner`

This id is more stable than the URL. The URL can change while the semantic state often stays the same.

## Hidden State

A node may not appear in the public URL:

```ts
app: {
  path: '/app',
  url: { hide: true }
}
```

That means:

- `app` exists in the state tree
- but it does not need to appear in the public URL

## Virtual State

Some nodes exist only for grouping. They do not need to participate in the URL matching chain.

## Resolve Logic

Sometimes a state can resolve to different child states based on an internal condition:

```ts
resolve: [
  { target: 'owner', guard: 'profile.isOwner' },
  { target: 'viewer' }
]
```

This lets the same URL lead to different semantic outcomes.

## Next Step

[03 Routing And URLs](./03-routing-and-urls.md)
