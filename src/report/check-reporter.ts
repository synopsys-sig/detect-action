import { GitHubCheck } from '../github/check'
import { Reporter } from './reporter'
import { ReportResult } from '../model/report-result'

const FAIL_SUMMARY = 'Components found that violate your Black Duck Policies!'
const SUCCESS_SUMMARY =
  'No components found that violate your Black Duck policies!'
const REPORT_CONTENT_TRUNCATED =
  '**Note: Report truncated due to character limit constraints!**'

export class CheckReporter implements Reporter {
  private static getSummary(summary: string, truncated: boolean): string {
    const result = truncated
      ? [summary, '', REPORT_CONTENT_TRUNCATED]
      : [summary]
    return result.join('\n')
  }

  private readonly gitHubCheck: GitHubCheck
  constructor(gitHubCheck: GitHubCheck) {
    this.gitHubCheck = gitHubCheck
  }

  async report(data: ReportResult): Promise<void> {
    if (data.failed) {
      await this.gitHubCheck.fail(
        CheckReporter.getSummary(FAIL_SUMMARY, data.truncated),
        data.report
      )
    } else {
      await this.gitHubCheck.pass(
        CheckReporter.getSummary(SUCCESS_SUMMARY, data.truncated),
        data.report
      )
    }
  }
}
