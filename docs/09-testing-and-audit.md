# HSM Testing And Audit

As HSM grows, the question "is it working correctly?" gets harder. That is why the testing and audit modules matter so much.

## What Do You Want to Test?

- which state a URL resolves to
- whether hidden route rules still work
- whether the query schema changed
- whether frontend and backend policy still match
- whether unauthenticated access opened up
- whether an open redirect risk appeared

## Testing API

HSM provides testing helpers such as:

- HSM test definitions
- step runners
- assertion helpers
- text and JSON reporters

## Audit Idea

The audit layer does not only ask "is this the expected result?" It also asks "does anything look suspicious from a security or consistency perspective?"

Example probe areas:

- hidden route
- route canonicalization
- query tampering
- permission escalation
- unauthenticated access
- open redirect
- backend policy mismatch

## Why It Matters

Because HSM apps are semantically rich, regressions can sometimes show up late in UI tests. The audit layer helps move those checks earlier.

## Book End

Return to the entry page in [HSM Docs](./README.md).
