import {context, getOctokit} from '@actions/github'
import {GITHUB_TOKEN} from './inputs'

const COMMENT_PREFACE = '<!-- Comment automatically managed by Detect Action, do not remove this line -->'

export async function commentOnPR(report: string): Promise<void> {
  const octokit = getOctokit(GITHUB_TOKEN)

  const message = COMMENT_PREFACE.concat('\r\n', report)

  const contextIssue = context.issue.number
  const contextOwner = context.repo.owner
  const contextRepo = context.repo.repo

  const {data: existingComments} = await octokit.rest.issues.listComments({
    issue_number: contextIssue,
    owner: contextOwner,
    repo: contextRepo
  })

  for (const comment of existingComments) {
    const firstLine = comment.body?.split('\r\n')[0]
    if (firstLine === COMMENT_PREFACE) {
      octokit.rest.issues.deleteComment({
        comment_id: comment.id,
        owner: contextOwner,
        repo: contextRepo
      })
    }
  }

  octokit.rest.issues.createComment({
    issue_number: contextIssue,
    owner: contextOwner,
    repo: contextRepo,
    body: message
  })
}
