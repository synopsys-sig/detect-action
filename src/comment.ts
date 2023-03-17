import { debug } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { APPLICATION_NAME } from './application-constants'
import { GITHUB_TOKEN } from './inputs'

const COMMENT_PREFACE = '<!-- Comment automatically managed by Detect Action, do not remove this line -->'

export async function commentOnPR(report: string, hasPolicyViolations: boolean): Promise<void> {
  const octokit = getOctokit(GITHUB_TOKEN)

  const message = COMMENT_PREFACE.concat('\r\n', report)

  const contextIssue = context.issue.number
  const contextOwner = context.repo.owner
  const contextRepo = context.repo.repo

  debug('Gathering existing comments...')
  const { data: existingComments } = await octokit.rest.issues.listComments({
    issue_number: contextIssue,
    owner: contextOwner,
    repo: contextRepo
  })

  let foundSameComment = false
  let hadExistingComment = false
  for (const comment of existingComments) {
    const firstLine = comment.body?.split('\r\n')[0]
    if (firstLine === COMMENT_PREFACE) {
      if (comment.body === message) {
        foundSameComment = true
      } else {
        debug(`Existing comment from ${APPLICATION_NAME} found. Attempting to update it...`)
        hadExistingComment = true
        octokit.rest.issues.deleteComment({
          comment_id: comment.id,
          owner: contextOwner,
          repo: contextRepo
        })
      }
    }
  }

  if (!foundSameComment && (hasPolicyViolations || hadExistingComment)) {
    debug('Creating a new comment...')
    octokit.rest.issues.createComment({
      issue_number: contextIssue,
      owner: contextOwner,
      repo: contextRepo,
      body: message
    })
    debug('Successfully created a new comment!')
  }
}
