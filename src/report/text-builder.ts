export class TextBuilder {
  private readonly maxSize?: number
  private lines: string[] = []
  private sizeUpperBound = 0

  constructor(maxSize?: number) {
    this.maxSize = maxSize
  }

  addLines(...lines: string[]): void {
    this.doAddLines(lines, true)
  }

  tryAddLines(...lines: string[]): boolean {
    return this.doAddLines(lines, false)
  }

  private doAddLines(lines: string[], required: boolean): boolean {
    const requiredSizeForLines = this.computeRequiredSizeForLines(lines)
    const hasSpaceLeft = this.hasSpaceLeft(requiredSizeForLines)
    if (required || hasSpaceLeft) {
      this.ensureBounds(requiredSizeForLines)
      this.lines.push(...lines)
      this.sizeUpperBound += requiredSizeForLines
    }
    return hasSpaceLeft
  }

  private hasSpaceLeft(delta: number): boolean {
    return (
      this.maxSize === undefined || this.sizeUpperBound + delta <= this.maxSize
    )
  }

  private computeRequiredSizeForLines(lines: string[]): number {
    const size = lines.reduce(
      (previousValue, currentValue) => previousValue + currentValue.length,
      0
    )
    const newLines = lines.length > 1 ? lines.length - 1 : 0
    return lines.length <= 0
      ? 0
      : (this.lines.length > 0 ? 1 : 0) + size + newLines
  }

  private ensureBounds(delta: number): void {
    if (!this.hasSpaceLeft(delta)) {
      throw new Error(`Character limit ${this.maxSize} reached!`)
    }
  }

  build(): string {
    return this.lines.join('\n')
  }
}
