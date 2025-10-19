#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { createGreeting, isCi } from './index.js'

type GlobalFlags = {
  readonly verbose: boolean
}

function logInfo(msg: string, flags: GlobalFlags): void {
  if (flags.verbose ? true : false) {
    console.info(msg)
  }
}

function usage(): string {
  return [
    'modern-cli <command> [options]',
    '',
    'Commands:',
    '  greet        Print a greeting',
    '  env          Show selected env values',
    '',
    'Global flags:',
    '  --verbose    Enable verbose logs',
    '  -h, --help   Show help',
    '',
  ].join('\n')
}

async function main(argv: Array<string>, env: NodeJS.ProcessEnv): Promise<number> {
  const args0: Array<string> = argv.slice(2)
  const { values, positionals } = parseArgs({
    args: args0,
    options: {
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: false,
  })

  const verboseFlag = typeof values.verbose === 'boolean' ? values.verbose : false
  const flags: GlobalFlags = { verbose: verboseFlag }

  if (values.help || positionals.length === 0) {
    // eslint-disable-next-line no-console
    console.log(usage())
    return 0
  }

  const [command] = positionals
  const cmdIndex = typeof command === 'string' ? args0.indexOf(command) : -1
  const rest: Array<string> = cmdIndex >= 0 ? args0.slice(cmdIndex + 1) : []

  switch (command) {
    case 'greet':
      return runGreet(rest, flags)
    case 'env':
      return runEnv(rest, flags, env)
    default:
      console.error(`Unknown command: ${command}\n`)
      // eslint-disable-next-line no-console
      console.log(usage())
      return 1
  }
}

function runGreet(args: Array<string>, flags: GlobalFlags): number {
  const { values } = parseArgs({
    args,
    options: { name: { type: 'string', default: 'world' } },
    allowPositionals: true,
  })
  logInfo('Running greet…', flags)
  const name = typeof values.name === 'string' ? values.name : 'world'
  const msg = createGreeting(name)
  console.info(msg)
  return 0
}

function runEnv(_args: Array<string>, flags: GlobalFlags, env: NodeJS.ProcessEnv): number {
  logInfo('Reading environment…', flags)
  const token = env.MY_STARTER_TOKEN ? '<set>' : '<missing>'
  const ci = isCi(env) ? 'yes' : 'no'
  console.info(JSON.stringify({ MY_STARTER_TOKEN: token, CI: ci }, null, 2))
  return 0
}

main(process.argv, process.env)
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err))
    process.exit(1)
  })
