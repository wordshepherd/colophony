import type { BaseAdapter } from "./common.js";

export interface CheckoutSessionParams {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface PaymentWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface WebhookHandleResult {
  handled: boolean;
  action?: string;
}

export interface RefundResult {
  refundId: string;
  status: "succeeded" | "pending" | "failed";
  amount: number;
}

export interface PaymentAdapter extends BaseAdapter {
  createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult>;
  verifyWebhook(
    headers: Record<string, string>,
    body: string,
  ): Promise<PaymentWebhookEvent>;
  handleWebhookEvent(event: PaymentWebhookEvent): Promise<WebhookHandleResult>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
}
