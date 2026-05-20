import type { AnyRecord } from "../core/types.js";
import type {
  HsmAgentSafetyConfig,
  HsmAgentSuite,
  HsmAgentSuiteConfig
} from "./types.js";
import { normalizeSafetyPolicy, HsmAgentSafetyPolicy } from "./HsmAgentSafetyPolicy.js";
import { agentProfiles } from "./profiles/index.js";

export function defineHsmAgentSuite<TContext extends AnyRecord = AnyRecord>(
  config: HsmAgentSuiteConfig<TContext>
): HsmAgentSuite<TContext> {
  if (!config?.name) throw new Error("Agent suite requires a name.");
  if (!config?.target?.origin) throw new Error("Agent suite requires target.origin.");
  if (!config?.agents?.count || config.agents.count <= 0) {
    throw new Error("Agent suite requires agents.count > 0.");
  }
  if (!config.agents.durationMs && !config.agents.maxSteps) {
    throw new Error("Agent suite requires agents.durationMs or agents.maxSteps.");
  }

  const safety = normalizeSafetyPolicy(config.safety);
  const policy = new HsmAgentSafetyPolicy(safety);
  const origin = config.target.origin;
  const allowedOrigins = config.target.allowedOrigins ?? [origin];

  const validation = policy.validateTarget({ origin, allowedOrigins });
  if (!validation.ok) {
    throw new Error(`Agent target rejected by safety policy (${validation.reason ?? "unknown"}).`);
  }

  const profiles = config.agents.profiles && config.agents.profiles.length > 0
    ? config.agents.profiles
    : [agentProfiles.anonymous()];

  const seed = config.agents.seed ?? "auto";

  return {
    ...config,
    kind: "hsm-agent-suite",
    safety,
    target: {
      ...config.target,
      origin,
      allowedOrigins
    },
    agents: {
      ...config.agents,
      seed,
      profiles,
      mode: config.agents.mode ?? "simulation"
    }
  };
}

export function normalizeAgentSafety(config?: HsmAgentSafetyConfig): Required<HsmAgentSafetyConfig> {
  return normalizeSafetyPolicy(config);
}
