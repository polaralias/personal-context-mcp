# personal-context-mcp

## Runtime

### Logging

The service uses structured JSON logs via `pino`. Each log entry includes a `component` field, and
request logs include `requestId` when an inbound header is available (`x-request-id`,
`x-correlation-id`, or `x-amzn-trace-id`). Errors are logged with an `err` object that captures the
stack trace.

Example log entry:

```json
{"level":30,"time":1730000000000,"component":"routes:status","requestId":"abc-123","msg":"failed to fetch status","err":{"type":"Error","message":"...","stack":"..."}}
```

### Health checks

`GET /healthz` returns application health and verifies database connectivity by executing a simple
query. On success it returns:

```json
{"status":"ok","db":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

On failure it returns HTTP 503 with `{"status":"error","db":"unavailable",...}`.
