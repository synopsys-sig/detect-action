import { summary } from '@actions/core'
import { Reporter } from './reporter'
import { ReportResult } from '../model/report-result'

export class SummaryReporter implements Reporter {
  private theSummary: typeof summary
  constructor(theSummary: typeof summary) {
    this.theSummary = theSummary
  }

  async report(data: ReportResult): Promise<void> {
    await this.theSummary.addRaw(data.report).write()
  }
}
