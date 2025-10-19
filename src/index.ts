export type CliContext = {
  readonly env: NodeJS.ProcessEnv
  readonly stdout: NodeJS.WriteStream
  readonly stderr: NodeJS.WriteStream
}

export function createGreeting(name: string): string {
  return `Hello, ${name}!`
}

export function isCi(env: NodeJS.ProcessEnv): boolean {
  return env.CI ? true : false
}
