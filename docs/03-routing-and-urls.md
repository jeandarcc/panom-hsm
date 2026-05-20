# HSM Routing And URLs

HSM derives router behavior from the state tree.

## Path Definition

Each state can carry a `path`:

```ts
profile: {
  path: '/profile/:username'
}
```

From that definition, HSM derives:

- parameter extraction
- URL matching
- URL generation

## URL Generation

```ts
hsm.href('app.profile', { username: 'yusuf' })
```

That lets you generate URLs from state instead of string concatenation.

## Hide and Canonical URL

The internal state path and the public URL do not have to be the same.

```ts
app: {
  path: '/app',
  url: { hide: true },
  states: {
    profile: { path: '/profile/:username' }
  }
}
```

Result:

- state: `app.profile`
- URL: `/profile/yusuf`

## Host-Aware Navigation

HSM can model host decisions, not just paths. That is especially important for subdomain and canonical-host behavior.

## Relation to the Browser

Routing is not only "path matching":

- popstate
- redirect safety
- canonical rewrite
- history push/replace

These behaviors are integrated with HSM through the browser runtime.

## Next Step

[04 Query State](./04-query-state.md)
