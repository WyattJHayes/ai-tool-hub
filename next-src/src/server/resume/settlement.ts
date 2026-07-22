import 'server-only';

import type { QuotaSettlementOutcome } from './quota';

export interface SettlementCoordinator {
  settle(outcome: QuotaSettlementOutcome): Promise<QuotaSettlementOutcome>;
  outcome(): QuotaSettlementOutcome | null;
}

export function createSettlementCoordinator(
  perform: (outcome: QuotaSettlementOutcome) => Promise<unknown>,
): SettlementCoordinator {
  let terminalOutcome: QuotaSettlementOutcome | null = null;
  let queue: Promise<unknown> = Promise.resolve();

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
    outcome() {
      return terminalOutcome;
    },
  };
}
