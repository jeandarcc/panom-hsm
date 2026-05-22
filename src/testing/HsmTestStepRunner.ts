import type { AnyRecord } from "../core/types.js";
import type { HsmTestExpectation, HsmTestStep, HsmTestStepResult } from "./types.js";
import { HsmAssertions } from "./HsmAssertions.js";
import { HsmTestContext } from "./HsmTestContext.js";

interface StepRunnerOptions<TContext extends AnyRecord = AnyRecord> {
  readonly testName: string;
  readonly stepIndex: number;
  readonly step: HsmTestStep<TContext>;
  readonly testSeverity: "info" | "low" | "medium" | "high" | "critical";
  readonly backendMethods?: readonly string[];
  readonly redirectSafety?: { validate: (input: string) => { ok: boolean; normalized?: string; reason?: string } };
}

export class HsmTestStepRunner<TContext extends AnyRecord = AnyRecord> {
  public async run(
    context: HsmTestContext<TContext>,
    options: StepRunnerOptions<TContext>
  ): Promise<HsmTestStepResult<TContext>> {
    const { step } = options;

    if (step.type === "context") {
      context.patchContext(step.patch);
      return {
        step,
        snapshot: context.currentSnapshot,
        transition: context.lastTransition ?? undefined,
        findings: []
      };
    }

    if (step.type === "visit") {
      context.lastUrl = step.url;
      const followRedirects = step.followRedirects ?? (step.expect?.redirectTo ? false : undefined);
      const result = await context.adapter.transitionUrl(step.url, {
        context: context.currentContext,
        followRedirects,
        canonicalizeAliases: step.canonicalizeAliases,
        preserveUnknownQuery: step.preserveUnknownQuery,
        hydrateQuery: step.hydrateQuery
      });
      context.lastTransition = result;
      if (result.ok) {
        context.currentSnapshot = result.snapshot;
        context.currentContext = result.snapshot.context as TContext;
      }
      return this.finishStep(context, options, step.expect, result);
    }

    if (step.type === "transition") {
      const result = await context.adapter.transition(step.target, {
        params: step.params,
        context: context.currentContext
      });
      context.lastTransition = result;
      if (result.ok) {
        context.currentSnapshot = result.snapshot;
        context.currentContext = result.snapshot.context as TContext;
      }
      return this.finishStep(context, options, step.expect, result);
    }

    if (step.type === "event") {
      const result = await context.adapter.send(step.event, step.payload, {
        context: context.currentContext
      });
      context.lastTransition = result;
      if (result.ok) {
        context.currentSnapshot = result.snapshot;
        context.currentContext = result.snapshot.context as TContext;
      }
      return this.finishStep(context, options, step.expect, result);
    }

    if (step.type === "assert") {
      const snapshot = context.currentSnapshot;
      const findings = HsmAssertions.evaluate(step.expect, {
        testName: options.testName,
        stepIndex: options.stepIndex,
        stepType: step.type,
        severity: options.testSeverity,
        snapshot,
        transition: context.lastTransition,
        adapter: context.adapter,
        lastUrl: context.lastUrl,
        backendMethods: options.backendMethods,
        redirectSafety: options.redirectSafety
      });
      return {
        step,
        snapshot,
        transition: context.lastTransition ?? undefined,
        findings
      };
    }

    return {
      step,
      snapshot: context.currentSnapshot,
      transition: context.lastTransition ?? undefined,
      findings: []
    };
  }

  private finishStep(
    context: HsmTestContext<TContext>,
    options: StepRunnerOptions<TContext>,
    expect: HsmTestExpectation | undefined,
    transition: HsmTestStepResult<TContext>["transition"]
  ): HsmTestStepResult<TContext> {
    const snapshot = context.currentSnapshot;
    const findings = expect
      ? HsmAssertions.evaluate(expect as HsmTestExpectation, {
          testName: options.testName,
          stepIndex: options.stepIndex,
          stepType: options.step.type,
          severity: options.testSeverity,
          snapshot,
          transition,
          adapter: context.adapter,
          lastUrl: context.lastUrl,
          backendMethods: options.backendMethods,
          redirectSafety: options.redirectSafety
        })
      : [];

    if (!transition?.ok && (!expect || expect.denied !== true)) {
      findings.push({
        id: `${options.testName}:${options.stepIndex}:transition_failed`,
        title: "transition_failed",
        severity: options.testSeverity,
        category: "runtime",
        testName: options.testName,
        stepIndex: options.stepIndex,
        message: transition?.error instanceof Error ? transition.error.message : "Transition failed.",
        expected: "transition ok",
        actual: transition?.reason
      });
    }

    return {
      step: options.step,
      snapshot,
      transition,
      findings
    };
  }
}
