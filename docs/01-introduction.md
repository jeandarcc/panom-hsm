# HSM Introduction

`@panomapp/hsm` exists to bring together the scattered concerns of page routing, query parsing, permission handling, backend authorization, and browser synchronization into one model.

## What Problem It Solves

Traditional web apps spread the same decision across many places:

- which screen a route should open
- how a query string should be parsed
- what the user is allowed to see
- which layout should be selected
- which backend endpoint should allow access
- what the canonical URL should be

That spread creates bugs and inconsistencies over time.

## What HSM Promises

A single state tree:

- resolves URLs
- binds query state
- evaluates policy
- produces backend guards
- stays in sync with browser history

## Simple Mental Model

State ids are semantic:

- `landing`
- `app.profile.owner`
- `cloud.media.detail`

The public URL can be shorter:

- `/`
- `/profile/yusuf`
- `/cloud/media/42`

So the internal state path and the external URL do not have to match exactly.

## Core Layers

1. `core`
2. `routing`
3. `query`
4. `policy`
5. `browser`
6. `backend`
7. `vue`
8. `testing`

## Next Step

[02 State Tree](./02-state-tree.md)
