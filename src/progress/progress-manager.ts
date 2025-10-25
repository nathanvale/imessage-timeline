import cliProgress from 'cli-progress'

/**
 * Configuration for progress bar display
 */
export type ProgressConfig = {
  /** Disable progress bars entirely */
  quiet?: boolean
  /** Custom format string for progress bars */
  format?: string
  /** Width of progress bar in characters (default: 40) */
  barSize?: number
  /** Frequency of progress updates in ms (default: 500) */
  updateFrequency?: number
}

/**
 * Unified progress bar manager with consistent styling across the pipeline
 */
export class ProgressManager {
  private multiBar: cliProgress.MultiBar | null = null
  private bars: Map<string, cliProgress.SingleBar> = new Map()
  private isQuiet: boolean
  private format: string
  private barSize: number
  private updateFrequency: number

  constructor(config: ProgressConfig = {}) {
    this.isQuiet = config.quiet ?? false
    this.barSize = config.barSize ?? 40
    this.updateFrequency = config.updateFrequency ?? 500

    // Consistent format across all progress bars
    // Shows: [████████░░░░░░░░░░░░░░░░░░░░░░░] 35.5% | 1234/3456 | ETA: 12s | Current item
    this.format =
      config.format ?? `{name} [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s | {current}`

    // Setup signal handlers for cleanup on Ctrl+C
    this.setupSignalHandlers()
  }

  /**
   * Create a new progress bar
   */
  public createBar(
    name: string,
    total: number,
    options?: { autoValue?: number },
  ): cliProgress.SingleBar {
    if (this.isQuiet) {
      return this.createDummyBar()
    }

    // Initialize multi-bar container if needed
    if (!this.multiBar) {
      this.multiBar = new cliProgress.MultiBar(
        {
          clearOnComplete: false,
          hideCursor: true,
          format: this.format,
          barCompleteChar: '█',
          barIncompleteChar: '░',
          barsize: this.barSize,
          fps: 1000 / this.updateFrequency, // Update frequency in FPS
        },
        cliProgress.Presets.shades_classic,
      )
    }

    const bar = this.multiBar.create(total, options?.autoValue ?? 0, {
      name: this.padName(name),
      current: 'starting...',
    })

    this.bars.set(name, bar)
    return bar
  }

  /**
   * Update progress with current item description
   */
  public updateCurrent(barName: string, current: string): void {
    const bar = this.bars.get(barName)
    if (bar && !this.isQuiet) {
      const progress = bar.getProgress()
      bar.update(progress, {
        current: this.truncate(current, 40),
      })
    }
  }

  /**
   * Increment progress by value
   */
  public increment(barName: string, value: number = 1, current?: string): void {
    const bar = this.bars.get(barName)
    if (bar && !this.isQuiet) {
      const total = bar.getTotal()
      const percentage = bar.getProgress()
      const currentAbsolute = Math.round(total * percentage)
      const newValue = Math.min(currentAbsolute + value, total)
      bar.update(newValue, {
        current: current ? this.truncate(current, 40) : undefined,
      })
    }
  }

  /**
   * Set progress to specific value
   */
  public setProgress(barName: string, value: number, current?: string): void {
    const bar = this.bars.get(barName)
    if (bar && !this.isQuiet) {
      const total = bar.getTotal()
      const newValue = Math.min(value, total)
      bar.update(newValue, {
        current: current ? this.truncate(current, 40) : undefined,
      })
    }
  }

  /**
   * Stop and remove a progress bar
   */
  public stopBar(barName: string): void {
    const bar = this.bars.get(barName)
    if (bar && !this.isQuiet) {
      bar.stop()
    }
    this.bars.delete(barName)
  }

  /**
   * Stop all progress bars and cleanup
   */
  public stopAll(): void {
    for (const [name] of this.bars) {
      this.stopBar(name)
    }
    if (this.multiBar && !this.isQuiet) {
      this.multiBar.stop()
    }
    this.multiBar = null
    this.bars.clear()
  }

  /**
   * Get current progress value for a bar (0 to total)
   */
  public getProgress(barName: string): number {
    const bar = this.bars.get(barName)
    if (bar) {
      const total = bar.getTotal()
      const percentage = bar.getProgress()
      // getProgress() returns 0-1 decimal, convert to absolute value
      return Math.round(total * percentage)
    }
    return 0
  }

  /**
   * Get total for a bar
   */
  public getTotal(barName: string): number {
    const bar = this.bars.get(barName)
    if (bar) {
      return bar.getTotal()
    }
    return 0
  }

  /**
   * Check if progress bars are visible
   */
  public isVisible(): boolean {
    return !this.isQuiet
  }

  /**
   * Create a dummy bar that doesn't render (for quiet mode)
   */
  private createDummyBar(): cliProgress.SingleBar {
    return {
      start: () => {},
      stop: () => {},
      increment: () => {},
      update: () => {},
      setTotal: () => {},
      getProgress: () => 0,
      getTotal: () => 0,
      updateETA: () => {},
      render: () => {},
      isActive: false,
    } as unknown as cliProgress.SingleBar
  }

  /**
   * Pad name to consistent width
   */
  private padName(name: string): string {
    const maxLen = 25
    if (name.length >= maxLen) {
      return name.substring(0, maxLen - 3) + '...'
    }
    return name.padEnd(maxLen)
  }

  /**
   * Truncate string with ellipsis
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) {
      return str
    }
    return str.substring(0, maxLen - 3) + '...'
  }

  /**
   * Setup signal handlers for cleanup on interrupt
   */
  private setupSignalHandlers(): void {
    const cleanup = () => {
      this.stopAll()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Also cleanup on uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.stopAll()
      console.error('Uncaught exception:', error)
      process.exit(1)
    })
  }
}

/**
 * Create a progress manager instance with common defaults
 */
export function createProgressManager(quiet?: boolean): ProgressManager {
  if (quiet === undefined) {
    return new ProgressManager({})
  }
  return new ProgressManager({ quiet })
}

/**
 * Convenience function for simple single progress bar operations
 */
export async function withProgress<T>(
  name: string,
  total: number,
  callback: (bar: cliProgress.SingleBar) => Promise<T>,
  quiet?: boolean,
): Promise<T> {
  const manager =
    quiet === undefined ? new ProgressManager({}) : new ProgressManager({ quiet: quiet as boolean })
  const bar = manager.createBar(name, total)

  try {
    const result = await callback(bar)
    manager.stopBar(name)
    return result
  } catch (error) {
    manager.stopBar(name)
    throw error
  }
}
