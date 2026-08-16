import 'server-only';

import type { QuotaSettlementOutcome } from './quota';

export interface SettlementCoordinator {
  settle(outcome: QuotaSettlementOutcome): Promise<QuotaSettlementOutcome>;
  compensate(): Promise<'refunded'>;
  outcome(): QuotaSettlementOutcome | null;
}

export function createSettlementCoordinator(
  perform: (outcome: QuotaSettlementOutcome) => Promise<unknown>,
  performCompensation?: () => Promise<unknown>,
): SettlementCoordinator {
  let terminalOutcome: QuotaSettlementOutcome | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let compensationAttempt: Promise<'refunded'> | undefined;

  return {
    settle(outcome) {
      const attempt = queue.then(async () => {
        if (terminalOutcome) return terminalOutcome;
        await perform(outcome);
        terminalOutcome = outcome;
        return outcome;
      });
      queue = attempt.catch(() => undefined);
      return attempt;
    },
    compensate() {
      if (compensationAttempt) return compensationAttempt;
      const attempt = queue.then(async () => {
        if (terminalOutcome === 'refunded') return 'refunded' as const;
        // NOTE: a consumed ledger is still compensable here BY DESIGN — the
        // JSON routes (parse / analyze-jd) rely on refunding a consumption
        // whose response was never delivered, and the SQL layer supports it
        // (resume_billing.sql: "compensate-consumed"). Guards against
        // refunding content that was already streamed belong to the caller
        // that knows whether delivery happened (see optimize route).
        await (performCompensation ?? (() => perform('refunded')))();
        terminalOutcome = 'refunded';
        return 'refunded' as const;
      });
      compensationAttempt = attempt;
      queue = attempt.catch(() => undefined);
      return attempt;
    },
    outcome() {
      return terminalOutcome;
    },
  };
}
