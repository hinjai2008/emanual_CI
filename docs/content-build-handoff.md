# Content Build Handoff (Email Notification Only)

This workflow builds updated content and notifies admin via email without an approval gate.

## Workflow File

- `.github/workflows/content-build-handoff.yml`

## Trigger Modes

1. `repository_dispatch` type: `content_update_requested`
2. `workflow_dispatch` manual run for testing

## Incoming Payload (repository_dispatch)

Example payload body for GitHub API call:

```json
{
  "event_type": "content_update_requested",
  "client_payload": {
    "request_id": "req-20260328-001",
    "admin_id": "admin-12",
    "rawdata_base64": "<base64 encoded rawData.json>",
    "snapshot_url": "https://api.example.com/snapshots/req-20260328-001/rawData.json",
    "snapshot_sha256": "<optional sha256>",
    "admin_email": "admin@example.com",
    "notification_channel": "email-only"
  }
}
```

Notes:
- Use either `rawdata_base64` or `snapshot_url`.
- If both are provided, `rawdata_base64` takes precedence.
- `admin_email` can be omitted if `ADMIN_BUILD_EMAIL_TO` secret is configured.
- Email notifications are sent automatically when SMTP is configured.

## Required Secrets

### Email Notification Secrets (required for email delivery)

- `ADMIN_BUILD_EMAIL_TO`: Default recipient email address for admin notifications
- `ADMIN_SMTP_SERVER`: SMTP host (for example `smtp.office365.com`)
- `ADMIN_SMTP_PORT`: SMTP port (for example `587`)
- `ADMIN_SMTP_USERNAME`: SMTP username
- `ADMIN_SMTP_PASSWORD`: SMTP password or app password
- `ADMIN_SMTP_FROM`: Sender address shown in email notifications

### Optional Secrets

- `ADMIN_BUILD_EMAIL_CC`: CC recipient for email notifications
- `CONTENT_SNAPSHOT_BEARER`: Bearer token for fetching `snapshot_url` when needed (optional)

If SMTP secrets are present and an email recipient is configured (`admin_email` payload or `ADMIN_BUILD_EMAIL_TO` secret), the workflow sends success/failure emails automatically.

## Trigger Example

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <github-token>" \
  https://api.github.com/repos/<owner>/<repo>/dispatches \
  -d '{
    "event_type":"content_update_requested",
    "client_payload":{
      "request_id":"req-20260328-001",
      "admin_id":"admin-12",
      "snapshot_url":"https://api.example.com/snapshots/req-20260328-001/rawData.json",
      "admin_email":"admin@example.com"
    }
  }'
```

## Notes

- This workflow does not deploy to production.
- It is an email-based handoff pipeline: build, package, email notification, admin-reviewed final publish.
- Success and failure emails include artifact metadata and download links.
- Build artifacts are stored in GitHub Actions for 14 days (configurable).
