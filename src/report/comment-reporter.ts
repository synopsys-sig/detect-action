import { Reporter } from './reporter'
import { GitHubPRCommenter } from '../github/comment'
import { ReportResult } from '../model/report-result'

export class CommentReporter implements Reporter {
  private gitHubPRCommenter: GitHubPRCommenter

  constructor(gitHubPRCommenter: GitHubPRCommenter) {
    this.gitHubPRCommenter = gitHubPRCommenter
  }

  async report(data: ReportResult): Promise<void> {
    await this.gitHubPRCommenter.comment(data.report)
  }
}
