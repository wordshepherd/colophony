import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripePaymentAdapter } from '../stripe-sdk.adapter.js';

const mockCreate = vi.fn();
const mockConstructEvent = vi.fn();
const mockRefundCreate = vi.fn();
const mockBalanceRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      checkout: {
        sessions: { create: (...args: unknown[]) => mockCreate(...args) },
      },
      webhooks: {
        constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
      },
      refunds: { create: (...args: unknown[]) => mockRefundCreate(...args) },
      balance: { retrieve: () => mockBalanceRetrieve() },
    };
  }),
}));

describe('StripePaymentAdapter', () => {
  let adapter: StripePaymentAdapter;

  const baseConfig = {
    secretKey: 'sk_test_123',
    webhookSecret: 'whsec_test',
    timestampToleranceSeconds: 300,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    adapter = new StripePaymentAdapter();
    await adapter.initialize(baseConfig);
  });

  it('initialize creates Stripe client', async () => {
    const Stripe = (await import('stripe')).default;
    expect(Stripe).toHaveBeenCalledWith('sk_test_123');
  });

  it('createCheckoutSession creates session with correct line_items', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    const result = await adapter.createCheckoutSession({
      amount: 2000,
      currency: 'usd',
      description: 'Submission fee',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(result.sessionId).toBe('cs_test_123');
    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 2000,
            }),
          }),
        ]),
      }),
    );
  });

  it('createCheckoutSession passes metadata and customerId', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'cs_1', url: '' });

    await adapter.createCheckoutSession({
      amount: 1000,
      currency: 'usd',
      metadata: { orgId: 'org-1' },
      customerId: 'cus_123',
      successUrl: 'https://x.com/ok',
      cancelUrl: 'https://x.com/no',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { orgId: 'org-1' },
        customer: 'cus_123',
      }),
    );
  });

  it('verifyWebhook validates signature and returns parsed event', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', amount_total: 2000 } },
    });

    const result = await adapter.verifyWebhook(
      { 'stripe-signature': 'sig_test' },
      '{"raw": "body"}',
    );

    expect(result.id).toBe('evt_123');
    expect(result.type).toBe('checkout.session.completed');
    expect(mockConstructEvent).toHaveBeenCalledWith(
      '{"raw": "body"}',
      'sig_test',
      'whsec_test',
      300,
    );
  });

  it('verifyWebhook throws on missing stripe-signature header', async () => {
    await expect(adapter.verifyWebhook({}, '{}')).rejects.toThrow(
      'Missing stripe-signature header',
    );
  });

  it('verifyWebhook throws on invalid signature', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    await expect(
      adapter.verifyWebhook({ 'stripe-signature': 'bad' }, '{}'),
    ).rejects.toThrow('Invalid signature');
  });

  it('handleWebhookEvent returns handled: false', async () => {
    const result = await adapter.handleWebhookEvent({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {},
    });
    expect(result.handled).toBe(false);
  });

  it('refund creates full refund when amount omitted', async () => {
    mockRefundCreate.mockResolvedValueOnce({
      id: 're_1',
      status: 'succeeded',
      amount: 2000,
    });

    const result = await adapter.refund('pi_123');

    expect(result.refundId).toBe('re_1');
    expect(result.status).toBe('succeeded');
    expect(result.amount).toBe(2000);
    expect(mockRefundCreate).toHaveBeenCalledWith({ payment_intent: 'pi_123' });
  });

  it('refund creates partial refund when amount specified', async () => {
    mockRefundCreate.mockResolvedValueOnce({
      id: 're_2',
      status: 'pending',
      amount: 500,
    });

    const result = await adapter.refund('pi_123', 500);
    expect(result.status).toBe('pending');
    expect(mockRefundCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_123',
      amount: 500,
    });
  });

  it('refund maps succeeded/pending/failed status', async () => {
    mockRefundCreate.mockResolvedValueOnce({
      id: 're_3',
      status: 'canceled',
      amount: 0,
    });

    const result = await adapter.refund('pi_1');
    expect(result.status).toBe('failed');
  });

  it('healthCheck calls balance.retrieve', async () => {
    mockBalanceRetrieve.mockResolvedValueOnce({ available: [] });

    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(true);
    expect(mockBalanceRetrieve).toHaveBeenCalled();
  });

  it('healthCheck returns unhealthy on API error', async () => {
    mockBalanceRetrieve.mockRejectedValueOnce(new Error('Invalid API Key'));

    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.message).toBe('Invalid API Key');
  });

  it('throws when methods called before initialize', async () => {
    const freshAdapter = new StripePaymentAdapter();
    await expect(
      freshAdapter.createCheckoutSession({
        amount: 100,
        currency: 'usd',
        successUrl: 'x',
        cancelUrl: 'y',
      }),
    ).rejects.toThrow('not initialized');
  });

  it('configSchema rejects missing secretKey', () => {
    const result = adapter.configSchema.safeParse({
      webhookSecret: 'whsec_test',
    });
    expect(result.success).toBe(false);
  });
});
