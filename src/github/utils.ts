import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'

const prEvents = [
  'pull_request',
  'pull_request_target',
  'pull_request_review',
  'pull_request_review_comment'
]
const REFS_REGEX = RegExp('refs/(heads|tags)/')

export class ContextExtensions {
  private readonly context: Context

  private constructor(context: Context) {
    this.context = context
  }

  isPullRequest(): boolean {
    return prEvents.includes(this.context.eventName)
  }

  getSha(): string {
    let sha = this.context.sha
    if (this.isPullRequest()) {
      const pull = this.context.payload.pull_request
      if (pull?.head.sha) {
        sha = pull?.head.sha
      }
    }

    return sha
  }

  getCurrentBranchName(): string {
    return this.context.ref.replace(REFS_REGEX, '')
  }

  getCurrentCommitId(short = true): string {
    let commitId = this.context.sha
    if (short) commitId = commitId.substring(0, 7)
    return commitId
  }

  static of(context: Context): ContextExtensions {
    return new ContextExtensions(context)
  }
}

export const contextExt: ContextExtensions = ContextExtensions.of(
  github.context
)
