import type { HsmAgentAccount, HsmAgentAccountProvider, HsmAgentProfile } from "./types.js";

export class HsmAgentAccountManager {
  public constructor(private readonly provider?: HsmAgentAccountProvider) {}

  public async create<TProfile extends HsmAgentProfile>(profile: TProfile): Promise<HsmAgentAccount | undefined> {
    if (!this.provider?.create) return undefined;
    return this.provider.create(profile);
  }

  public async destroy(account?: HsmAgentAccount): Promise<void> {
    if (!account || !this.provider?.destroy || this.provider.keepAccounts) return;
    await this.provider.destroy(account);
  }

  public redact(account?: HsmAgentAccount): HsmAgentAccount | undefined {
    if (!account) return undefined;
    return {
      ...account,
      auth: account.auth
        ? {
          token: account.auth.token ? "[redacted]" : undefined,
          cookies: redactMap(account.auth.cookies),
          headers: redactMap(account.auth.headers)
        }
        : undefined
    };
  }
}

function redactMap(values?: Readonly<Record<string, string>>): Record<string, string> | undefined {
  if (!values) return undefined;
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (/(token|cookie|authorization|password|secret)/i.test(key)) {
      redacted[key] = "[redacted]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
