# Security remediation: orphan commit `73f079a`

**Authorized by:** repository owner (pianopia)  
**Date:** 2026-10-27  
**GitHub Secret Scanning:** alert #1 (open at time of remediation)

## Summary

Commit `73f079a3905559763ff1bc4b84743398f701ef8f` (`create: repository`) previously contained hardcoded credentials in:

| Path | Issue |
|------|--------|
| `test.py` | Hardcoded Gemini / Google API key |
| `api/src/routes/llm.ts` | Hardcoded `GOOGLE_API_KEY` |
| `api/Dockerfile` | Hardcoded `DATABASE_URL` and Turso `DATABASE_AUTH_TOKEN` |

Those paths are **not present** on current `main` (`68ea762` and later). History was restarted at `579180a` (*Initial commit: Clean start with security-safe files*) without ancestry to `73f079a`.

## Verification (current state)

Run:

```bash
chmod +x scripts/verify-no-secrets.sh
./scripts/verify-no-secrets.sh
```

Expected: `OK` — no secrets in the working tree or in any **reachable** commit on refs:

- `refs/heads/main`
- `refs/heads/add-usage-documentation`

API keys for Gemini/OpenAI/Claude in the CLI are loaded from local config (`aireer config --*-key`) or runtime configuration only; there is no `api/` service tree on `main`.

## Git refs and force-push

All remote branches were verified to **not** contain `73f079a` in their history. Branches were force-pushed with `--force-with-lease` after remediation documentation to confirm remote refs match the scrubbed history.

## Orphan SHA still visible on GitHub

`git fetch origin 73f079a3905559763ff1bc4b84743398f701ef8f` may still succeed because GitHub retains unreachable objects by SHA until purged.

**After** replacement credentials are deployed and DB/API access is verified, the owner should:

1. Rotate the leaked Gemini API key and Turso token (agents do **not** revoke credentials).
2. Open a [GitHub Support](https://support.github.com/) request to **purge cached repository data** for commit `73f079a3905559763ff1bc4b84743398f701ef8f` (and any dependent unreachable objects).
3. In **Security → Secret scanning alerts**, resolve alert **#1** as **Revoked** (or the appropriate resolution) once rotation is complete.

## Credential rotation policy (owner only)

Do **not** revoke Gemini or Turso credentials until:

- Successful deploy with replacement secrets (environment variables / secret manager), **and**
- Verified database and API access using the new credentials.
