import type { ExtractedResumeText } from './importer';
import type {
  ResumeChange,
  ResumeDocumentV1,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
} from './types';
import type {
  ResumePaymentClient,
  ResumePaymentOrder,
  ResumePlansAvailability,
  ResumePurchasablePlan,
} from './api';
import type { ResumeQuotaSummary } from './types';

export type ResumeImportMode = 'merge' | 'replace';
export type ResumeSaveState = 'unsaved' | 'saving' | 'saved' | 'error';

export interface ResumeImportPreview {
  extracted: ExtractedResumeText;
  document: ResumeDocumentV1;
}

export interface ImportDialogState {
  preview: ResumeImportPreview | null;
  busy: boolean;
  error: string;
}

export type ImportDialogAction =
  | { type: 'start' }
  | { type: 'ready'; preview: ResumeImportPreview }
  | { type: 'failure'; error: string }
  | { type: 'set-busy'; busy: boolean }
  | { type: 'reset' };

export const initialImportDialogState: ImportDialogState = {
  preview: null,
  busy: false,
  error: '',
};

export function reduceImportDialogState(
  state: ImportDialogState,
  action: ImportDialogAction,
): ImportDialogState {
  switch (action.type) {
    case 'start':
      return { preview: null, busy: true, error: '' };
    case 'ready':
      return { preview: action.preview, busy: false, error: '' };
    case 'failure':
      return { ...state, busy: false, error: action.error };
    case 'set-busy':
      return { ...state, busy: action.busy };
    case 'reset':
      return initialImportDialogState;
  }
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function contentKey(item: ResumeExperience | ResumeProject | ResumeEducation): string {
  return Object.entries(item)
    .filter(([key]) => key !== 'id')
    .map(([, value]) => value.trim())
    .join('\u0000');
}

function uniqueItems<T extends ResumeExperience | ResumeProject | ResumeEducation>(values: T[]): T[] {
  const keys = new Set<string>();
  return values.filter(value => {
    const key = contentKey(value);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function buildResumeImportCandidate(
  mode: ResumeImportMode,
  current: ResumeDocumentV1,
  imported: ResumeDocumentV1,
): ResumeDocumentV1 {
  if (mode === 'replace') return imported;

  return {
    ...current,
    name: !hasText(current.name) || current.name.trim() === 'Untitled resume' ? imported.name : current.name,
    profile: {
      ...current.profile,
      fullName: preferPopulatedText(current.profile.fullName, imported.profile.fullName),
      phone: preferPopulatedText(current.profile.phone, imported.profile.phone),
      email: preferPopulatedText(current.profile.email, imported.profile.email),
      location: preferPopulatedText(current.profile.location, imported.profile.location),
      title: preferPopulatedText(current.profile.title, imported.profile.title),
    },
    target: preferPopulatedText(current.target, imported.target),
    summary: preferPopulatedText(current.summary, imported.summary),
    experience: uniqueItems([...current.experience, ...imported.experience]),
    projects: uniqueItems([...current.projects, ...imported.projects]),
    education: uniqueItems([...current.education, ...imported.education]),
    skills: uniqueText([...current.skills, ...imported.skills]),
    certificates: uniqueText([...current.certificates, ...imported.certificates]),
  };
}

export interface ResumeImportTransactionState {
  document: ResumeDocumentV1;
  undoStack: ResumeDocumentV1[];
  changeUndoStack: ResumeChange[][];
  stagedImport: ResumeDocumentV1 | null;
  changes: ResumeChange[];
  backup: ResumeDocumentV1 | null;
}

export interface ResumeImportTransactionAdapter {
  getState: () => ResumeImportTransactionState;
  stageImport: (candidate: ResumeDocumentV1) => void;
  acceptStagedImport: () => void;
  restoreState: (snapshot: ResumeImportTransactionState) => void;
}

export type ResumeImportTransactionResult =
  | { ok: true }
  | { ok: false; error: unknown };

function cloneTransactionState(state: ResumeImportTransactionState): ResumeImportTransactionState {
  return structuredClone({
    document: state.document,
    undoStack: state.undoStack,
    changeUndoStack: state.changeUndoStack,
    stagedImport: state.stagedImport,
    changes: state.changes,
    backup: state.backup,
  });
}

export function commitResumeImport(
  mode: ResumeImportMode,
  current: ResumeDocumentV1,
  imported: ResumeDocumentV1,
  adapter: ResumeImportTransactionAdapter,
): ResumeImportTransactionResult {
  const snapshot = cloneTransactionState(adapter.getState());

  try {
    const candidate = buildResumeImportCandidate(mode, current, imported);
    adapter.stageImport(candidate);
    adapter.acceptStagedImport();
    return { ok: true };
  } catch (error) {
    try {
      adapter.restoreState({ ...snapshot, stagedImport: null });
    } catch {
      // Zustand mutates memory before persistence; restoration can succeed in memory and still throw.
    }
    return { ok: false, error };
  }
}

export interface ResumeImportConfirmation {
  prepare: (mode: ResumeImportMode) => ResumeDocumentV1;
  confirm: (mode: ResumeImportMode) => ResumeImportTransactionResult;
}

export function createResumeImportConfirmation(
  current: ResumeDocumentV1,
  imported: ResumeDocumentV1,
  adapter: ResumeImportTransactionAdapter,
): ResumeImportConfirmation {
  return {
    prepare: mode => buildResumeImportCandidate(mode, current, imported),
    confirm: mode => commitResumeImport(mode, current, imported, adapter),
  };
}

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

function preferPopulatedText(current: string, imported: string): string {
  return hasText(current) ? current : imported;
}

const DIALOG_FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([hidden])',
  'input:not([disabled]):not([hidden]):not([type="hidden"])',
  'select:not([disabled]):not([hidden])',
  'textarea:not([disabled]):not([hidden])',
  '[href]:not([hidden])',
  '[tabindex]:not([tabindex="-1"]):not([hidden])',
].join(',');

function isRenderedFocusable(element: HTMLElement): boolean {
  if (element.hidden || element.tabIndex < 0 || element.getAttribute('aria-hidden') === 'true') return false;
  if ('disabled' in element && Boolean((element as HTMLButtonElement).disabled)) return false;
  return element.getClientRects().length > 0;
}

export function getDialogFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)].filter(isRenderedFocusable);
}

export function trapDialogTabKey(event: KeyboardEvent, dialog: HTMLElement): boolean {
  if (event.key !== 'Tab') return false;
  const focusable = getDialogFocusableElements(dialog);
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable.at(-1)!;
  const activeElement = dialog.ownerDocument?.activeElement ?? null;
  const isDialogFallback = activeElement === dialog;
  if (event.shiftKey && (activeElement === first || isDialogFallback || !dialog.contains(activeElement))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (activeElement === last || isDialogFallback || !dialog.contains(activeElement))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function isResumeExperiencePopulated(item: ResumeExperience): boolean {
  return [item.company, item.role, item.startDate, item.endDate, item.description].some(hasText);
}

export function isResumeProjectPopulated(item: ResumeProject): boolean {
  return [item.name, item.role, item.startDate, item.endDate, item.description].some(hasText);
}

export function isResumeEducationPopulated(item: ResumeEducation): boolean {
  return [item.school, item.major, item.degree, item.startDate, item.endDate].some(hasText);
}

export function countPopulatedResumeFields(document: ResumeDocumentV1): number {
  return [
    document.profile.fullName,
    document.profile.phone,
    document.profile.email,
    document.profile.location,
    document.profile.title,
    document.target,
    document.summary,
    ...document.experience.flatMap(item => [item.company, item.role, item.startDate, item.endDate, item.description]),
    ...document.projects.flatMap(item => [item.name, item.role, item.startDate, item.endDate, item.description]),
    ...document.education.flatMap(item => [item.school, item.major, item.degree, item.startDate, item.endDate]),
    ...document.skills,
    ...document.certificates,
  ].filter(hasText).length;
}

export interface SaveStatusScheduler {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timer: unknown) => void;
}

export interface SaveStatusController {
  commit: (mutation: () => void) => void;
  dispose: () => void;
}

export function createSaveStatusController(
  onStatusChange: (status: ResumeSaveState) => void,
  scheduler: SaveStatusScheduler,
): SaveStatusController {
  let savingTimer: unknown = null;
  let settledTimer: unknown = null;

  const clearTimers = () => {
    if (savingTimer !== null) scheduler.clearTimeout(savingTimer);
    if (settledTimer !== null) scheduler.clearTimeout(settledTimer);
    savingTimer = null;
    settledTimer = null;
  };

  return {
    commit(mutation) {
      clearTimers();
      onStatusChange('unsaved');
      let settledStatus: ResumeSaveState = 'saved';
      try {
        mutation();
      } catch {
        settledStatus = 'error';
      }
      savingTimer = scheduler.setTimeout(() => {
        savingTimer = null;
        onStatusChange('saving');
        settledTimer = scheduler.setTimeout(() => {
          settledTimer = null;
          onStatusChange(settledStatus);
        }, 220);
      }, 0);
    },
    dispose: clearTimers,
  };
}

export type PendingResumeAction =
  | { kind: 'parse' }
  | { kind: 'analyze-jd' }
  | { kind: 'optimize'; level: 'light' | 'medium' | 'deep' }
  | { kind: 'open-quota' };

export interface PendingResumeActionController {
  defer(action: PendingResumeAction): void;
  peek(): PendingResumeAction | null;
  resume(handler: (action: PendingResumeAction) => void): void;
  clear(): void;
}

export function createPendingResumeActionController(): PendingResumeActionController {
  let pending: PendingResumeAction | null = null;
  return {
    defer(action) {
      pending = { ...action };
    },
    peek: () => pending ? { ...pending } : null,
    resume(handler) {
      if (!pending) return;
      const action = pending;
      pending = null;
      handler(action);
    },
    clear() {
      pending = null;
    },
  };
}

export interface ProtectedResumeActionContext {
  document: ResumeDocumentV1;
  jobDescription: string;
}

interface ProtectedResumeActionCoordinatorOptions {
  isAuthenticated: () => boolean;
  getDocument: () => ResumeDocumentV1;
  getJobDescription: () => string;
  onAuthenticationRequired: (action: PendingResumeAction) => void;
  onExecute: (action: PendingResumeAction, context: ProtectedResumeActionContext) => void;
}

export interface ProtectedResumeActionCoordinator {
  request: (action: PendingResumeAction) => void;
  onAuthenticated: () => void;
  cancelPending: () => void;
}

export function createProtectedResumeActionCoordinator(
  options: ProtectedResumeActionCoordinatorOptions,
): ProtectedResumeActionCoordinator {
  let pending: PendingResumeAction | null = null;
  const execute = (action: PendingResumeAction) => options.onExecute({ ...action }, {
    document: options.getDocument(),
    jobDescription: options.getJobDescription(),
  });

  return {
    request(action) {
      if (options.isAuthenticated()) {
        execute(action);
        return;
      }
      pending = { ...action };
      options.onAuthenticationRequired({ ...action });
    },
    onAuthenticated() {
      if (!pending || !options.isAuthenticated()) return;
      const action = pending;
      pending = null;
      execute(action);
    },
    cancelPending() {
      pending = null;
    },
  };
}

interface AIUndoControllerOptions {
  getDocument: () => ResumeDocumentV1;
  undo: () => void;
}

export function createAIUndoController(options: AIUndoControllerOptions) {
  let acceptedDocument: ResumeDocumentV1 | null = null;
  return {
    markAccepted() {
      acceptedDocument = options.getDocument();
    },
    canUndo() {
      return acceptedDocument !== null && options.getDocument() === acceptedDocument;
    },
    undo() {
      if (acceptedDocument === null || options.getDocument() !== acceptedDocument) {
        acceptedDocument = null;
        return false;
      }
      acceptedDocument = null;
      options.undo();
      return true;
    },
    clear() {
      acceptedDocument = null;
    },
  };
}

interface ResumeAccountRefreshClient {
  getQuota: () => Promise<ResumeQuotaSummary>;
  getPlansAvailability: () => Promise<ResumePlansAvailability>;
}

export interface ResumeAccountRefreshResult {
  quota: ResumeQuotaSummary | null;
  availability: ResumePlansAvailability | null;
  version: number;
}

export async function refreshResumeAccountState(
  client: ResumeAccountRefreshClient,
  currentVersion: number,
): Promise<ResumeAccountRefreshResult> {
  const [quota, availability] = await Promise.allSettled([
    client.getQuota(),
    client.getPlansAvailability(),
  ]);
  return {
    quota: quota.status === 'fulfilled' ? quota.value : null,
    availability: availability.status === 'fulfilled' ? availability.value : null,
    version: currentVersion + 1,
  };
}

type ScalarSection = 'profile' | 'target' | 'summary';
type RepeatableSection = 'experience' | 'projects' | 'education';
type CollectionSection = RepeatableSection | 'skills' | 'certificates';

function appendChange(
  changes: ResumeChange[],
  makeId: () => string,
  section: ScalarSection | RepeatableSection,
  field: string,
  before: string,
  after: string,
  itemId?: string,
) {
  if (before === after) return;
  changes.push({ id: makeId(), section, itemId, field, before, after, accepted: false });
}

function appendCollectionChange(
  changes: ResumeChange[],
  makeId: () => string,
  section: CollectionSection,
  before: unknown[],
  after: unknown[],
) {
  const beforeJson = JSON.stringify(before);
  const afterJson = JSON.stringify(after);
  if (beforeJson === afterJson) return;
  changes.push({
    id: makeId(),
    section,
    field: 'items',
    before: beforeJson,
    after: afterJson,
    accepted: false,
  });
}

export function computeResumeChanges(
  current: ResumeDocumentV1,
  candidate: ResumeDocumentV1,
  makeId: () => string = () => globalThis.crypto.randomUUID(),
): ResumeChange[] {
  const changes: ResumeChange[] = [];
  for (const field of ['fullName', 'phone', 'email', 'location', 'title'] as const) {
    appendChange(changes, makeId, 'profile', field, current.profile[field], candidate.profile[field]);
  }
  appendChange(changes, makeId, 'target', 'target', current.target, candidate.target);
  appendChange(changes, makeId, 'summary', 'summary', current.summary, candidate.summary);

  const fields: Record<RepeatableSection, readonly string[]> = {
    experience: ['company', 'role', 'startDate', 'endDate', 'description'],
    projects: ['name', 'role', 'startDate', 'endDate', 'description'],
    education: ['school', 'major', 'degree', 'startDate', 'endDate'],
  };
  for (const section of ['experience', 'projects', 'education'] as const) {
    const hasStableStructure = current[section].length === candidate[section].length
      && current[section].every((item, index) => candidate[section][index]?.id === item.id);
    if (!hasStableStructure) {
      appendCollectionChange(changes, makeId, section, current[section], candidate[section]);
      continue;
    }
    const candidates = new Map(candidate[section].map(item => [item.id, item]));
    for (const item of current[section]) {
      const next = candidates.get(item.id) as Record<string, string> | undefined;
      if (!next) continue;
      for (const field of fields[section]) {
        appendChange(
          changes,
          makeId,
          section,
          field,
          (item as unknown as Record<string, string>)[field],
          next[field],
          item.id,
        );
      }
    }
  }
  appendCollectionChange(changes, makeId, 'skills', current.skills, candidate.skills);
  appendCollectionChange(changes, makeId, 'certificates', current.certificates, candidate.certificates);
  return changes;
}

export interface PaymentScheduler {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(timer: unknown): void;
  now(): number;
}

export interface ResumePaymentControllerState {
  order: ResumePaymentOrder | null;
  history: ResumePaymentOrder[];
  busy: boolean;
  timedOut: boolean;
  error: string;
}

export interface ResumePaymentControllerCallbacks {
  onState?(state: ResumePaymentControllerState): void;
  onOrder?(order: ResumePaymentOrder): void;
  openPayment?(url: string): void;
  onFulfilled?(): void;
}

export interface ResumePaymentController {
  loadHistory(): Promise<ResumePaymentOrder[]>;
  confirmPurchase(plan: ResumePurchasablePlan): Promise<void>;
  manualQuery(): Promise<void>;
  getState(): ResumePaymentControllerState;
  dispose(): void;
}

const PAYMENT_POLL_INTERVAL_MS = 3_000;
const PAYMENT_POLL_TIMEOUT_MS = 5 * 60_000;

export function createResumePaymentController(
  client: ResumePaymentClient,
  scheduler: PaymentScheduler,
  callbacks: ResumePaymentControllerCallbacks,
): ResumePaymentController {
  let state: ResumePaymentControllerState = {
    order: null,
    history: [],
    busy: false,
    timedOut: false,
    error: '',
  };
  let pollTimer: unknown = null;
  let deadlineTimer: unknown = null;
  let startedAt = 0;
  let disposed = false;
  let fulfilledOrderId: string | null = null;
  const activeRequests = new Set<AbortController>();

  const publish = (patch: Partial<ResumePaymentControllerState>) => {
    state = { ...state, ...patch };
    callbacks.onState?.({ ...state, history: [...state.history] });
  };
  const clearPollTimer = () => {
    if (pollTimer !== null) scheduler.clearTimeout(pollTimer);
    pollTimer = null;
  };
  const clearDeadlineTimer = () => {
    if (deadlineTimer !== null) scheduler.clearTimeout(deadlineTimer);
    deadlineTimer = null;
  };
  const clearPollingTimers = () => {
    clearPollTimer();
    clearDeadlineTimer();
  };
  const abortRequests = () => {
    for (const request of activeRequests) request.abort();
    activeRequests.clear();
  };
  const startRequest = () => {
    const request = new AbortController();
    activeRequests.add(request);
    return request;
  };
  const observe = (order: ResumePaymentOrder) => {
    publish({ order, busy: false, error: '' });
    callbacks.onOrder?.(order);
    if (order.status === 'fulfilled' && fulfilledOrderId !== order.id) {
      fulfilledOrderId = order.id;
      callbacks.onFulfilled?.();
    }
  };
  const markTimedOut = () => {
    if (disposed || state.order?.status !== 'pending') return;
    clearPollingTimers();
    abortRequests();
    publish({ busy: false, timedOut: true });
  };

  const query = async (manual: boolean) => {
    const orderId = state.order?.id;
    if (!orderId || disposed) return;
    const request = startRequest();
    try {
      const order = await client.getOrder(orderId, request.signal);
      if (
        disposed
        || order.id !== orderId
        || state.order?.id !== orderId
        || state.order.status !== 'pending'
      ) return;
      observe(order);
      if (order.status !== 'pending') {
        clearPollingTimers();
        abortRequests();
        return;
      }
      if (!manual && scheduler.now() - startedAt >= PAYMENT_POLL_TIMEOUT_MS) {
        markTimedOut();
        return;
      }
      if (!manual) {
        clearPollTimer();
        pollTimer = scheduler.setTimeout(() => { void query(false); }, PAYMENT_POLL_INTERVAL_MS);
      }
    } catch {
      if (disposed || request.signal.aborted) return;
      publish({ busy: false, error: '订单状态暂时不可用，请手动查询。' });
      clearPollingTimers();
    } finally {
      activeRequests.delete(request);
    }
  };

  return {
    async loadHistory() {
      if (disposed) return [];
      const request = startRequest();
      try {
        const history = await client.listOrders(request.signal);
        if (!disposed) publish({ history, error: '' });
        return history;
      } catch {
        if (!disposed && !request.signal.aborted) publish({ error: '订单记录暂时不可用。' });
        return [];
      } finally {
        activeRequests.delete(request);
      }
    },
    async confirmPurchase(plan) {
      if (disposed || state.busy || state.order?.status === 'pending') return;
      publish({ busy: true, timedOut: false, error: '' });
      const request = startRequest();
      try {
        const order = await client.createOrder(plan, request.signal);
        if (disposed) return;
        startedAt = scheduler.now();
        observe(order);
        if (order.paymentUrl) callbacks.openPayment?.(order.paymentUrl);
        if (order.status === 'pending') {
          clearPollingTimers();
          pollTimer = scheduler.setTimeout(() => { void query(false); }, PAYMENT_POLL_INTERVAL_MS);
          deadlineTimer = scheduler.setTimeout(markTimedOut, PAYMENT_POLL_TIMEOUT_MS);
        }
      } catch {
        if (!disposed && !request.signal.aborted) publish({ busy: false, error: '订单创建失败，请稍后重试。' });
      } finally {
        activeRequests.delete(request);
      }
    },
    manualQuery: () => query(true),
    getState: () => ({ ...state, history: [...state.history] }),
    dispose() {
      disposed = true;
      clearPollingTimers();
      abortRequests();
    },
  };
}
