# weihub.cloud Production Deployment

`weihub.cloud` is served by the Next.js application container. The existing
`dgc-nginx` container is the only public entrypoint on ports 80 and 443.
`dramagenai.cloud` remains a separate virtual host and is not modified by this
deployment. The existing static memorial page remains available at `/love/`.

## Prerequisites

- Docker Engine and Docker Compose v2 on `101.43.35.235`.
- Existing external Docker network `dramagenai-cloud_dgc-net`.
- Existing `dgc-nginx` container with the repository's certificate volume.
- TLS files under `/etc/letsencrypt/live/weihub.cloud` inside `dgc-nginx`.
- A secret environment file at `/opt/ai-tool-hub/.env`, mode `0600`.

The environment file must contain the application's production variables. Do
not commit it. At minimum, provide:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
XDDPAY_APP_ID=...
XDDPAY_SECRET=...
```

## Deploy

From the repository root:

```bash
deploy/tencent-cloud/quick-deploy.sh full
```

The script uploads `next-src`, builds the image on the server, replaces the
application transactionally, validates Nginx, and verifies both domains. It
does not publish port 3100 on the host. Nginx reaches the application through
the `weihub-app` alias on the external Docker network. After the new service is
healthy, the script disables the obsolete `ai-resume-optimizer.service` unit
that previously recreated a host-published container.

Useful commands:

```bash
deploy/tencent-cloud/quick-deploy.sh status
deploy/tencent-cloud/quick-deploy.sh logs
```

Override the default target when needed:

```bash
SERVER_HOST=root@101.43.35.235 deploy/tencent-cloud/quick-deploy.sh full
```

## Domain Verification

```bash
curl -I https://weihub.cloud/
curl -I https://www.weihub.cloud/
curl -I https://dramagenai.cloud/
```

Expected results:

- `weihub.cloud` and `www.weihub.cloud` return the AI Tool Hub application.
- `weihub.cloud/love/` returns the preserved static memorial page.
- `dramagenai.cloud` returns DramagenAI Cloud.
- `docker inspect ai-resume-optimizer` has no host binding for port 3100.

Timestamped backups are stored under `/opt/ai-tool-hub/backups/` on the server.
