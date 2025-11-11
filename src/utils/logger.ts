/**
 * Structured JSON Logger (Pino + JSONL)
 *
 * - Uses Pino for fast JSON logging to stdout
 * - Writes JSON Lines to ./logs/YYYY-MM-DD.jsonl when enabled
 * - Stable keys for Pinot ingestion (ts, level, component, msg, context, pid, ver, seq)
 *
 * Environment variables:
 *  LOG_LEVEL=debug|info|warn|error  minimum level (default info)
 *  LOG_FORMAT=json|pretty           pretty prints to stdout when set to pretty
 *  LOG_TO_FILE=true|false           write JSONL to ./logs (default true except during tests)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogEntry = {
  ts: string
  level: LogLevel
  component: string
  msg: string
  context?: Record<string, unknown>
  pid: number
  ver?: string
  seq: number
  correlationId?: string
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs'
import path from 'node:path'

import pino, { type Logger as PinoLogger } from 'pino'

let sequenceCounter = 0
let cachedVersion: string | undefined
let currentCorrelationId: string | undefined
const correlationStore = new AsyncLocalStorage<string>()
import pkgJson from '../../package.json' assert { type: 'json' }
function loadVersion(): string {
  if (cachedVersion) return cachedVersion!
  const version = (pkgJson as { version?: string }).version || '0.0.0'
  cachedVersion = version
  return version
}

const isTestEnv =
  process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
const shouldWriteFile =
  (process.env.LOG_TO_FILE ?? (isTestEnv ? 'false' : 'true')) === 'true'

// stdout logger via Pino
const baseLevel = (process.env.LOG_LEVEL || 'info') as LogLevel
const pinoTransport =
  process.env.LOG_FORMAT === 'pretty'
    ? pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, singleLine: true },
      })
    : undefined
const pinoStdout = pino({ level: baseLevel, base: null }, pinoTransport)

// JSONL file stream (lazy)
let fileStream: fs.WriteStream | undefined
let fileDate: string | undefined
function ensureFileStream(): void {
  if (!shouldWriteFile) return
  const nowDate = new Date().toISOString().slice(0, 10)
  if (fileStream && fileDate === nowDate) return
  try {
    const logsDir = path.resolve(process.cwd(), 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    const filePath = path.join(logsDir, `${nowDate}.jsonl`)
    if (fileStream) fileStream.end()
    fileStream = fs.createWriteStream(filePath, { flags: 'a' })
    fileDate = nowDate
  } catch {
    // swallow file sink errors to avoid impacting app
    fileStream = undefined
    fileDate = undefined
  }
}

// will be overridden with dynamic version later in file
// initial implementation kept for reference; dynamicShouldLog is used instead

// kept for backward compatibility in case other modules import it later
function _format(entry: LogEntry): string {
  return JSON.stringify(entry)
}

export function log(
  component: string,
  level: LogLevel,
  msg: string,
  context?: Record<string, unknown>,
): void {
  if (!dynamicShouldLog(level)) return
  const effectiveCorrelationId =
    correlationStore.getStore() ?? currentCorrelationId
  const entryBase: Omit<LogEntry, 'context' | 'correlationId'> = {
    ts: new Date().toISOString(),
    level,
    component,
    msg,
    pid: process.pid,
    ver: loadVersion(),
    seq: ++sequenceCounter,
  }
  const withCorr: Partial<Pick<LogEntry, 'correlationId'>> =
    effectiveCorrelationId ? { correlationId: effectiveCorrelationId } : {}
  const entryNoCtx: LogEntry = { ...(entryBase as LogEntry), ...withCorr }
  const entry: LogEntry = context ? { ...entryNoCtx, context } : entryNoCtx

  // 1) stdout via Pino (keeps human-friendly output and fast JSON)
  const bindings: Record<string, unknown> = {
    component,
    ver: entry.ver,
    seq: entry.seq,
  }
  if (entry.correlationId) bindings.correlationId = entry.correlationId
  const logger: PinoLogger = pinoStdout.child(bindings)
  // Pino expects object then msg for structured logs
  logger[level](context ?? {}, msg)

  // 2) JSONL file sink (Pinot-friendly schema)
  if (shouldWriteFile) {
    ensureFileStream()
    if (fileStream) fileStream.write(`${JSON.stringify(entry)}\n`)
  }

  // 3) Custom sinks (if any registered)
  if (sinks.length > 0) {
    try {
      for (const s of sinks) s(entry)
    } catch {
      // ignore sink errors
    }
  }
}

export type ComponentLogger = {
  debug: (msg: string, context?: Record<string, unknown>) => void
  info: (msg: string, context?: Record<string, unknown>) => void
  warn: (msg: string, context?: Record<string, unknown>) => void
  error: (msg: string, context?: Record<string, unknown>) => void
}

export function createLogger(component: string): ComponentLogger {
  return {
    debug: (msg, context) => log(component, 'debug', msg, context),
    info: (msg, context) => log(component, 'info', msg, context),
    warn: (msg, context) => log(component, 'warn', msg, context),
    error: (msg, context) => log(component, 'error', msg, context),
  }
}

// Pino/Pinot integration hooks (extendable)
// In the future we could batch and ship to Apache Pinot via HTTP/Kafka.
// For now we expose a hook for external collectors.
export type LogSink = (entry: LogEntry) => void
let sinks: LogSink[] = []
export function registerSink(sink: LogSink): void {
  sinks.push(sink)
}
export function clearSinks(): void {
  sinks = []
}

// Correlation ID management
export function setCorrelationId(id: string | undefined): void {
  currentCorrelationId = id
}

export function getCorrelationId(): string | undefined {
  return correlationStore.getStore() ?? currentCorrelationId
}

export async function withCorrelationId<T>(
  id: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const prev = currentCorrelationId
  currentCorrelationId = id
  return await correlationStore.run(id, async () => {
    try {
      return await fn()
    } finally {
      currentCorrelationId = prev
    }
  })
}

// Dynamic log level control
let dynamicLevel: LogLevel | undefined
export function setLogLevel(level: LogLevel): void {
  dynamicLevel = level
  try {
    // pino exposes level setter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pinoStdout as any).level = level
  } catch {
    // ignore if pinoStdout not ready
  }
}

function getEffectiveLevel(): LogLevel {
  return dynamicLevel || 'info'
}

// Override original shouldLog: replace earlier implementation by assigning new function
// Use a const to avoid duplicate declarations
const dynamicShouldLog = (level: LogLevel): boolean => {
  const envLevel = getEffectiveLevel()
  return LEVEL_ORDER[level] >= LEVEL_ORDER[envLevel]
}
