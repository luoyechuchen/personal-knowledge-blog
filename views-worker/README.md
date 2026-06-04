# Views Worker

This Worker records article views for the static blog without storing reader IPs.

## API

```text
POST /api/view
body: { "slug": "post-slug" }
```

This public endpoint only increments by one. It does not accept a custom count.

```text
GET /api/admin/views
Authorization: Bearer <VIEW_COUNTER_ADMIN_TOKEN>
```

This private endpoint returns totals for the local admin.

## Deploy

1. Copy the example config:

```bash
cp views-worker/wrangler.toml.example views-worker/wrangler.toml
```

2. Create a D1 database:

```bash
npx wrangler d1 create personal-blog-views
```

3. Paste the returned `database_id` into `views-worker/wrangler.toml`.

4. Create the tables:

```bash
npx wrangler d1 execute personal-blog-views --file views-worker/schema.sql
```

5. Set the private admin token:

```bash
npx wrangler secret put ADMIN_TOKEN --config views-worker/wrangler.toml
```

6. Deploy:

```bash
npx wrangler deploy --config views-worker/wrangler.toml
```

## Blog Configuration

Set the public endpoint in `public/view-counter.json`:

```json
{
  "endpoint": "https://your-worker.your-subdomain.workers.dev/api/view"
}
```

Set these local-only variables in the repository root `.env` for the admin:

```bash
VIEW_COUNTER_ADMIN_URL=https://your-worker.your-subdomain.workers.dev/api/admin/views
VIEW_COUNTER_ADMIN_TOKEN=your-private-token
```

Never commit `.env` or `views-worker/wrangler.toml`.
