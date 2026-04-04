# Billing System Validation Checklist

## Pre-Production Checklist

### Environment Configuration
- [ ] `CASHFREE_APP_ID` set in production
- [ ] `CASHFREE_SECRET_KEY` set in production
- [ ] `CASHFREE_WEBHOOK_SECRET` set in production
- [ ] `CRON_SECRET` set in production
- [ ] `BILLING_ACCOUNTS_ID` collection ID set
- [ ] `BILLING_AUDIT_LOGS_ID` collection ID set
- [ ] `EMAIL_API_KEY` set for reminder emails
- [ ] `NEXT_PUBLIC_APP_URL` set to production URL

### Cashfree Dashboard Configuration
- [ ] Webhook URL configured: `https://app.fairlx.com/api/webhooks/cashfree`
- [ ] Webhook events enabled:
  - [ ] `PAYMENT_SUCCESS_WEBHOOK`
  - [ ] `PAYMENT_FAILED_WEBHOOK`
  - [ ] `PAYMENT_USER_DROPPED_WEBHOOK`
  - [ ] `REFUND_SUCCESS_WEBHOOK`
  - [ ] `REFUND_FAILED_WEBHOOK`
- [ ] Test mode (sandbox) verified before production

### Cron Jobs (Droplet)
- [ ] Cron script deployed to Droplet
- [ ] `process-cycle` scheduled for 1st of month
- [ ] `enforce-grace` scheduled daily at 1 AM UTC
- [ ] `send-reminders` scheduled daily at 9 AM UTC
- [ ] Log directory created: `/var/log/fairlx-billing/`

---

## Functional Tests

### Payment Flow
- [ ] **Create billing account** - Organization setup creates billing record
- [ ] **Wallet top-up** - Cashfree Checkout opens and completes payment
- [ ] **Webhook received** - PAYMENT_SUCCESS_WEBHOOK event processed
- [ ] **Wallet credited** - Balance updated with correct USD amount
- [ ] **Account activated** - Status set to ACTIVE

### Billing Cycle
- [ ] **Usage aggregated** - Traffic, storage, compute summed correctly
- [ ] **Invoice generated** - Invoice document created with breakdown
- [ ] **Wallet deduction** - Auto-deduct from wallet balance
- [ ] **Success flow** - Invoice marked PAID, account ACTIVE
- [ ] **Failure flow** - Invoice marked FAILED, account DUE

### Grace Period
- [ ] **14-day countdown** - Grace period end calculated correctly
- [ ] **Warning banner** - Displays on all pages during DUE status
- [ ] **Day 1 email** - Initial payment failure notification sent
- [ ] **Day 7 email** - Reminder email sent
- [ ] **Day 13 email** - Final warning email sent
- [ ] **Day 14+ suspension** - Account status set to SUSPENDED

### Suspension
- [ ] **Writes blocked** - Cannot create projects, tasks, etc.
- [ ] **Reads allowed** - Can view existing data
- [ ] **Billing page accessible** - Can access billing settings
- [ ] **Other pages blocked** - Redirected to billing
- [ ] **Suspension UI** - Full-screen overlay displayed

### Recovery
- [ ] **Payment from suspended** - Can complete wallet top-up
- [ ] **Instant restoration** - Access restored immediately
- [ ] **Status updated** - Account back to ACTIVE
- [ ] **Audit logged** - Recovery event recorded

---

## Edge Cases

### Idempotency
- [ ] Duplicate webhooks ignored
- [ ] Multiple payment attempts handled
- [ ] No double wallet credits

### Error Handling
- [ ] Invalid webhook signatures rejected (HMAC-SHA256 with timestamp)
- [ ] Missing billing account handled gracefully
- [ ] Database errors logged and don't crash

### Data Integrity
- [ ] Invoice created BEFORE charge attempt
- [ ] Usage snapshots immutable after billing
- [ ] Audit trail complete for all events

### Currency Conversion
- [ ] USD → INR conversion correct (amounts in major units for Cashfree)
- [ ] Wallet credits in original USD cents
- [ ] Exchange rate stored in order tags for auditability

---

## Security Checks

- [ ] Webhook signatures verified (HMAC-SHA256 with timestamp)
- [ ] CRON_SECRET required for cron endpoints
- [ ] No sensitive data in client-side code
- [ ] Payment method details not stored
- [ ] Admin client used for billing operations

---

## Performance

- [ ] Webhook responds within 5 seconds
- [ ] Cron jobs complete within 60 seconds
- [ ] Billing status cached appropriately
- [ ] No N+1 queries in aggregation

---

## Sign-Off

| Item | Date | Verified By |
|------|------|-------------|
| Dev Testing | | |
| Staging Testing | | |
| Production Deployment | | |
| First Billing Cycle | | |
