import { GitHub } from '@actions/github/lib/utils'
import { Context } from '@actions/github/lib/context'
import * as core from '@actions/core'

function getCommentPreface(id: string): string {
  return `<!-- Comment automatically managed by ${id}, do not remove this line -->`
}

export class GitHubPRCommenter {
  private readonly applicationName: string
  private readonly octokit: InstanceType<typeof GitHub>
  private readonly context: Context
  private readonly commentPreface: string

  constructor(
    applicationName: string,
    octokit: InstanceType<typeof GitHub>,
    context: Context
  ) {
    this.applicationName = applicationName
    this.octokit = octokit
    this.context = context
    this.commentPreface = getCommentPreface(applicationName)
  }

  async comment(data: string): Promise<void> {
    const message = this.commentPreface.concat('\r\n', data)

    const contextIssue = this.context.issue.number
    const contextOwner = this.context.repo.owner
    const contextRepo = this.context.repo.repo

    core.debug('Gathering existing comments...')
    const { data: existingComments } =
      await this.octokit.rest.issues.listComments({
        issue_number: contextIssue,
        owner: contextOwner,
        repo: contextRepo
      })

    for (const comment of existingComments) {
      const firstLine = comment.body?.split('\r\n')[0]
      if (firstLine === this.commentPreface) {
        core.debug(
          `Existing comment from ${this.applicationName} found. Attempting to delete it...`
        )
        this.octokit.rest.issues.deleteComment({
          comment_id: comment.id,
          owner: contextOwner,
          repo: contextRepo
        })
      }
    }

    core.debug('Creating a new comment...')

    this.octokit.rest.issues.createComment({
      issue_number: contextIssue,
      owner: contextOwner,
      repo: contextRepo,
      body: message
    })

    core.debug('Successfully created a new comment!')
  }
}
