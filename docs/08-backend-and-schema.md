# HSM Backend And Schema

This chapter turns HSM from a frontend convenience into an application contract.

## Why Schema?

Frontend definitions contain functions such as:

- guard
- loader
- action

The backend wants a portable contract without functions. That is where schema comes in.

## Compile

```ts
import { compileSchema, defineHsm } from '@panomapp/hsm/schema'

const definition = defineHsm({
  id: 'app',
  states: {
    profile: { path: '/profile/:username' }
  }
})

const schema = compileSchema(definition)
```

## Backend Runtime

```ts
import { createHsmBackend } from '@panomapp/hsm/backend'

const backend = createHsmBackend({
  schema,
  guards: {
    'auth.required': async ({ context }) => Boolean(context.user)
  },
  context: async ({ request }) => ({ user: request.user })
})
```

## Express-Style Usage

```ts
app.get(
  '/api/profile/:username',
  backend.requirePermission('profile.view'),
  handler
)
```

## Key Principle

Frontend:

- knows what to show
- knows what should feel open or closed

Backend:

- knows what is actually allowed

When both sides speak the same HSM contract language, the system conflicts less.

## Next Step

[09 Testing And Audit](./09-testing-and-audit.md)
