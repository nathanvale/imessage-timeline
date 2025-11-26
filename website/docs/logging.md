# Logging and sinks

This project uses a structured logger built on Pino with optional JSONL file
sink.

- createLogger(component) returns an object with info/warn/error/debug methods.
- Log entries include: ts, level, component, msg, context, pid, ver, seq,
  correlationId.
- By default during tests, file output is disabled. Set LOG_TO_FILE=true to
  enable JSONL file sink (./logs/YYYY-MM-DD.jsonl).

## Quick usage

```ts
import {
  createLogger,
  setCorrelationId,
  withCorrelationId,
} from '#utils/logger'

const logger = createLogger('example:component')
logger.info('Starting work', { taskId: '123' })

setCorrelationId('req-abc')
logger.debug('Inside request scope')

await withCorrelationId('nested', async () => {
  logger.info('Nested scope logs carry correlationId')
})
```

## Custom sinks

You can subscribe to all entries for forwarding to another system (e.g.,
telemetry).

```ts
import { registerSink, clearSinks } from '#utils/logger'

registerSink((entry) => {
  // Send to external collector or buffer for tests
  // entry is the normalized LogEntry shape
})

// Later
clearSinks()
```

## CLI logging

CLI commands standardize informational output through the logger. Use
`--verbose` to increase verbosity (debug level) and `--quiet` to limit to errors
only.

Env controls:

- LOG_LEVEL=debug|info|warn|error (default info)
- LOG_FORMAT=pretty to enable human-friendly console formatting
- LOG_TO_FILE=true to enable JSONL file sink
