# HSM Query State

HSM treats query parameters as typed extensions of state, not as an unstructured string bag.

## Why It Matters

Plain query handling often causes:

- manual parsing
- scattered default values
- type cast mistakes
- noisy URLs

HSM centralizes that behavior.

## Query Binding

```ts
query: {
  tab: query.string('posts', { source: 'profile.tab' }),
  page: query.number(1, { source: 'profile.page' }),
  mine: query.boolean(false, { source: 'profile.onlyMine' })
}
```

What does this definition provide?

- decode
- encode
- default values
- context binding
- clean URL generation

## Binding to Context

Query is not only part of the URL; it is also written into HSM context.

```ts
snapshot.context.profile.page
```

This keeps state and URL from becoming separate systems.

## Clean URLs

Query values that match their defaults are pruned. That keeps URLs free of unnecessary additions like `?page=1`.

## Types

Common binder types:

- string
- number
- boolean
- string array

## Next Step

[05 Transitions And Loaders](./05-transitions-and-loaders.md)
