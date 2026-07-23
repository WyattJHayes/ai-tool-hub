'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleDollarSign, RefreshCw, X } from 'lucide-react';
import {
  type ResumePaymentClient,
  type ResumePaymentOrder,
  type ResumePlansAvailability,
  type ResumePurchasablePlan,
} from '@/features/resume/api';
import { createResumePaymentController, trapDialogTabKey, type ResumePaymentControllerState } from '@/features/resume/ui';
import type { ResumeQuotaSummary } from '@/features/resume/types';

interface QuotaDrawerProps {
  open: boolean;
  onClose: () => void;
  quota: ResumeQuotaSummary | null;
  availability: ResumePlansAvailability | null;
  refreshVersion: number;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  paymentClient?: ResumePaymentClient | null;
}

const DISABLED_AVAILABILITY: ResumePlansAvailability = {
  available: false,
  dailyQuota: null,
  xddpay: { enabled: false },
};

const EMPTY_PAYMENT_STATE: ResumePaymentControllerState = {
  order: null,
  history: [],
  busy: false,
  timedOut: false,
  error: '',
};

const BROWSER_PAYMENT_SCHEDULER = {
  setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer: unknown) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

const STATUS_LABELS: Record<ResumePaymentOrder['status'], string> = {
  pending: '待确认',
  fulfilled: '已履约',
  expired: '已过期',
  review: '人工核对中',
};

export function QuotaDrawer({
  open,
  onClose,
  quota,
  availability,
  refreshVersion,
  refreshing,
  onRefresh,
  paymentClient = null,
}: QuotaDrawerProps) {
  const [paymentState, setPaymentState] = useState(EMPTY_PAYMENT_STATE);
  const [selectedPlan, setSelectedPlan] = useState<ResumePurchasablePlan | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const effectiveAvailability = availability ?? DISABLED_AVAILABILITY;
  const channelEnabled = !refreshing && effectiveAvailability.xddpay.enabled === true && paymentClient !== null;
  const closeDrawer = useCallback(() => {
    setSelectedPlan(null);
    onCloseRef.current();
  }, []);
  const controller = useMemo(() => paymentClient ? createResumePaymentController(
    paymentClient,
    BROWSER_PAYMENT_SCHEDULER,
    {
      onState: setPaymentState,
      openPayment: url => window.open(url, '_blank', 'noopener,noreferrer'),
      onFulfilled: () => { void onRefresh(); },
    },
  ) : null, [onRefresh, paymentClient]);

  useEffect(() => () => controller?.dispose(), [controller]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    void onRefresh();
    void controller?.loadHistory();
  }, [controller, onRefresh, open]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key === 'Tab' && drawerRef.current) trapDialogTabKey(event, drawerRef.current);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [closeDrawer, open]);

  if (!open) return null;

  const confirmPurchase = () => {
    if (!selectedPlan || !channelEnabled || !controller) return;
    void controller.confirmPurchase(selectedPlan);
  };

  return (
    <div className="resume-drawer-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDrawer(); }}>
      <aside ref={drawerRef} className="resume-quota-drawer" role="dialog" aria-modal="true" aria-labelledby="resume-quota-title" tabIndex={-1} data-refresh-version={refreshVersion}>
        <header>
          <div><p>ACCOUNT / QUOTA</p><h2 id="resume-quota-title"><CircleDollarSign aria-hidden="true" />配额与会员</h2></div>
          <button ref={closeRef} type="button" className="resume-icon-control" onClick={closeDrawer} aria-label="关闭配额抽屉"><X aria-hidden="true" /></button>
        </header>

        <div className="resume-quota-drawer__body">
          <section className="resume-quota-summary" aria-live="polite">
            <span>当前方案</span><strong>{quota?.plan === 'vip' ? '永久 VIP' : quota?.plan === 'basic' ? '基础会员' : '免费用户'}</strong>
            <span>剩余额度</span><strong>{quota?.remaining === null && quota ? '不限次' : quota?.remaining ?? '--'}</strong>
            <span>免费每日额度</span><strong>{effectiveAvailability.dailyQuota ?? '--'}</strong>
          </section>

          <section className="resume-plan-list" aria-labelledby="resume-plan-title">
            <h3 id="resume-plan-title">会员方案</h3>
            <label><input type="radio" name="resume-plan" checked={selectedPlan === 'basic'} onChange={() => setSelectedPlan('basic')} disabled={!channelEnabled} /><span><strong>基础会员</strong><small>10 次</small></span><b>CNY 9.90</b></label>
            <label><input type="radio" name="resume-plan" checked={selectedPlan === 'vip'} onChange={() => setSelectedPlan('vip')} disabled={!channelEnabled} /><span><strong>永久 VIP</strong><small>不限次</small></span><b>CNY 99.00</b></label>
            {!channelEnabled ? <p className="resume-channel-disabled" role="status">支付渠道尚未通过生产校验，购买暂不可用。</p> : null}
            <button type="button" className="resume-command--accent" onClick={confirmPurchase} disabled={!selectedPlan || !channelEnabled || paymentState.busy}>确认购买</button>
          </section>

          {paymentState.order ? (
            <section className="resume-order-current" data-status={paymentState.order.status} aria-live="polite">
              <span>订单 {paymentState.order.id}</span><strong>{STATUS_LABELS[paymentState.order.status]}</strong>
              {paymentState.order.status === 'pending' ? <p>支付结果待确认，请勿重复下单。</p> : null}
              {paymentState.order.status === 'review' ? <p>订单正在人工核对，请联系支持并提供站内订单号。</p> : null}
              {paymentState.order.status === 'expired' ? <p>订单已过期，未增加会员权益。</p> : null}
              {paymentState.order.status === 'fulfilled' ? <p>权益已生效，配额已刷新。</p> : null}
              {paymentState.order.status === 'pending' ? <button type="button" onClick={() => void controller?.manualQuery()}><RefreshCw aria-hidden="true" />{paymentState.timedOut ? '手动查询' : '查询状态'}</button> : null}
            </section>
          ) : null}
          {paymentState.error ? <p className="resume-inline-error" role="alert">{paymentState.error}</p> : null}

          <section className="resume-order-history" aria-labelledby="resume-order-history-title">
            <h3 id="resume-order-history-title">订单记录</h3>
            {paymentState.history.length ? <ul>{paymentState.history.map(order => <li key={order.id}><span>{order.id}</span><strong>{STATUS_LABELS[order.status]}</strong></li>)}</ul> : <p>暂无订单记录</p>}
          </section>
        </div>
      </aside>
    </div>
  );
}
