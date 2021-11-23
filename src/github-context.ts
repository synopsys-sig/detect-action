import {context} from '@actions/github'
import {PullRequest} from './namespaces/Github'

const prEvents = ['pull_request', 'pull_request_review', 'pull_request_review_comment']

export function isPullRequest(): boolean {
  return prEvents.includes(context.eventName)
}

export function getSha(): string {
  let sha = context.sha
  if (isPullRequest()) {
    const pull = context.payload.pull_request as PullRequest
    if (pull?.head.sha) {
      sha = pull?.head.sha
    }
  }

  return sha
}
