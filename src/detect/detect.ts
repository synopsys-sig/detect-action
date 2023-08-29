import { exec } from '@actions/exec'

export class Detect {
  private readonly path: string
  constructor(path: string) {
    this.path = path
  }

  async run(args: string[]): Promise<number> {
    const detectArguments = ['-jar', this.path].concat(args)
    return exec(`java`, detectArguments, {
      ignoreReturnCode: true
    })
  }
}
