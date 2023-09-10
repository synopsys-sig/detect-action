import * as github from '@actions/github'
import { Context } from '@actions/github/lib/context'

const prEvents = [
  'pull_request',
  'pull_request_target',
  'pull_request_review',
  'pull_request_review_comment'
]
const REFS_REGEX = RegExp('refs/(heads|tags)/')

export interface ExtendedContext extends Context {
  isPullRequest(): boolean
  getSha(): string
  getCurrentBranchName(): string
  getCurrentCommitId(short: boolean): string
  getLinkToFile(filePath: string, line?: number): string
}

export function extendContext(context: Context): ExtendedContext {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any
  const result = <any>context

  result.isPullRequest = () => prEvents.includes(context.eventName)

  result.getSha = () => {
    let sha = context.sha
    if (result.isPullRequest()) {
      const pull = context.payload.pull_request
      if (pull?.head.sha) {
        sha = pull?.head.sha
      }
    }

    return sha
  }

  result.getCurrentBranchName = () => context.ref.replace(REFS_REGEX, '')

  result.getCurrentCommitId = (short: number) => {
    let commitId = context.sha
    if (short) commitId = commitId.substring(0, 7)
    return commitId
  }

  result.getLinkToFile = (filePath: string, line?: number): string => {
    const link = `${context.serverUrl}/${context.repo.owner}/${
      context.repo.repo
    }/blob/${result.getCurrentCommitId(false)}/${filePath}`
    return line !== undefined ? `${link}#L${line}` : link
  }

  return result
}

export const extendedContext: ExtendedContext = extendContext(github.context)
