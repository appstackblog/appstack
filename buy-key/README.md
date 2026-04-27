# FlameTech Key Storefront

Plain PHP/MySQL license-key storefront for cPanel shared hosting. The website does not generate license keys. It creates orders/free claims, verifies payment or link completion, then calls the Cloudflare Worker from PHP only.

## Structure

- `public_html/buy-key/` - upload this folder to your cPanel `public_html/buy-key`
- `database/schema.sql` - import this via phpMyAdmin
- `public_html/buy-key/config/config.example.php` - placeholder configuration
- `public_html/buy-key/config/config.php` - deployment configuration loaded by the app

## cPanel Deployment

1. Create a MySQL database and database user in cPanel.
2. Grant the user all privileges on the database.
3. Open phpMyAdmin and import `database/schema.sql`.
4. Upload the `buy-key/` folder into your hosting account's `public_html/buy-key/`.
5. Edit `public_html/buy-key/config/config.php` and set:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
   - `SITE_URL`
   - `WORKER_BASE_URL`
   - `WORKER_ADMIN_KEY`
   - bank details
   - payment webhook secret
   - free-link provider URL/secret
   - production plan prices
6. Create the first admin user:

```bash
php -r "echo password_hash('replace-with-a-strong-password', PASSWORD_DEFAULT), PHP_EOL;"
```

Then insert the generated hash in phpMyAdmin:

```sql
INSERT INTO admin_users (email, password_hash, created_at)
VALUES ('admin@example.com', '$2y$REPLACE_WITH_GENERATED_HASH', NOW());
```

7. Set your payment provider webhook URL to:

```text
https://appstack.blog/buy-key/api/payment-webhook.php
```

8. Set your free-link provider callback URL to:

```text
https://appstack.blog/buy-key/api/free-callback.php?token=<token>
```

For providers that accept a callback template, set `FREE_LINK_BASE_URL` like:

```php
'FREE_LINK_BASE_URL' => 'https://provider.example/unlock?callback={callback}',
```

## Payment Webhook Placeholder

The placeholder adapter accepts either:

- `X-Webhook-Secret: your-secret`
- `X-Signature: <hmac_sha256_raw_body_using_your_secret>`

Minimal JSON payload:

```json
{
  "event_id": "txn_123",
  "transfer_content": "FT260427ABC123",
  "amount": 99000,
  "reference": "BANK_TXN_123"
}
```

The handler is idempotent:

- duplicate processed event IDs are ignored
- paid orders with an existing key do not create a second key
- order rows are locked during payment completion and Worker key creation

## Worker Calls

Premium key creation uses:

```json
{
  "tier": "vip",
  "duration": "30d|90d|180d",
  "quantity": 1,
  "note": "premium order <order_id>"
}
```

Free key creation uses:

```json
{
  "tier": "free",
  "duration": "1d",
  "quantity": 1,
  "note": "free link claim <claim_id>"
}
```

The Worker admin key is sent only by PHP in the `x-server-key` header. It is never rendered into frontend JavaScript.

## Testing

1. Open `/buy-key/pricing.php`, create an order, and copy the transfer content.
2. Send a signed test webhook with that transfer content.
3. Open `/buy-key/order.php?id=<order_public_id>` and confirm the generated VIP key appears.
4. Open `/buy-key/free.php`, submit an email, complete the placeholder/free-link redirect, and confirm `/buy-key/free-success.php?id=<claim_public_id>` shows a free key.
5. Open `/buy-key/admin/login.php` and confirm orders, free claims, statuses, and generated keys are visible.

If your Worker has a different verification endpoint, update `WORKER_VERIFY_PATH` in `config.php`.
