#!/usr/bin/env node

/**
 * Pre-edit hook for payment-related code.
 * Warns if Stripe webhook handling code doesn't follow idempotency pattern.
 */

const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || '';
const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';

// Only check payment-related files
if (!filePath.includes('payment') && !filePath.includes('stripe') && !filePath.includes('webhook')) {
  process.exit(0);
}

// Check for webhook handling code without idempotency
const hasWebhookHandling =
  newContent.includes('event.type') ||
  newContent.includes('Stripe.Event') ||
  newContent.includes('handleWebhook') ||
  newContent.includes('webhook');

const hasIdempotencyCheck =
  newContent.includes('stripeWebhookEvents') ||
  newContent.includes('.processed') ||
  newContent.includes('eventId') ||
  newContent.includes('idempotencyKey');

if (hasWebhookHandling && !hasIdempotencyCheck) {
  console.warn('⚠️  WARNING: Stripe webhook code detected without idempotency check.');
  console.warn('   Ensure you check stripeWebhookEvents.processed before processing.');
  console.warn('   Pattern: Check → Store → Process → Mark processed');
  console.warn('   See: /stripe-webhook skill for the correct pattern.');
}

// Check for missing webhook event storage
const createsPayment =
  newContent.includes('db.insert(payments)') ||
  newContent.includes("insert(payments)");
const storesWebhookEvent =
  newContent.includes('db.insert(stripeWebhookEvents)') ||
  newContent.includes('insert(stripeWebhookEvents)');

if (createsPayment && !storesWebhookEvent && hasWebhookHandling) {
  console.warn('⚠️  WARNING: Creating payment without storing webhook event.');
  console.warn('   Store the event BEFORE processing to prevent duplicates.');
}

// Check for raw body requirement (Fastify)
if (newContent.includes('constructEvent') || newContent.includes('stripe-signature')) {
  if (!newContent.includes('rawBody') && !newContent.includes('request.rawBody')) {
    console.warn('⚠️  WARNING: Stripe signature verification requires raw body.');
    console.warn('   Register fastify-raw-body plugin and use request.rawBody');
  }
}

process.exit(0);
