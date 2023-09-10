import * as core from '@actions/core'
import { GitHub } from '@actions/github/lib/utils'
import { Context } from '@actions/github/lib/context'
import { ExtendedContext } from './extended-context'

export class GitHubCheckCreator {
  private readonly octokit: InstanceType<typeof GitHub>
  private readonly context: ExtendedContext

  constructor(octokit: InstanceType<typeof GitHub>, context: ExtendedContext) {
    this.octokit = octokit
    this.context = context
  }

  async create(name: string): Promise<GitHubCheck> {
    const head_sha = this.context.getSha()

    core.info(`Creating ${name}...`)

    const payload = {
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      name,
      head_sha
    }

    core.debug(`Check payload: ${JSON.stringify(payload)}`)

    const response = await this.octokit.rest.checks.create(payload)

    if (response.status !== 201) {
      core.warning(
        `Unexpected status code received when creating ${name}: ${response.status}`
      )
      core.debug(JSON.stringify(response, null, 2))
    } else {
      core.info(`${name} created`)
      core.debug(`Check response: ${JSON.stringify(response.data)}`)
    }

    return new GitHubCheck(this.octokit, this.context, name, response.data.id)
  }
}

export class GitHubCheck {
  private readonly octokit: InstanceType<typeof GitHub>
  private readonly context: Context
  private readonly checkName: string
  private readonly checkRunId: number

  constructor(
    octokit: InstanceType<typeof GitHub>,
    context: Context,
    checkName: string,
    checkRunId: number
  ) {
    this.octokit = octokit
    this.context = context
    this.checkName = checkName
    this.checkRunId = checkRunId
  }

  async pass(summary: string, text: string): Promise<void> {
    return this.finish('success', summary, text)
  }

  async fail(summary: string, text: string): Promise<void> {
    return this.finish('failure', summary, text)
  }

  async skip(): Promise<void> {
    return this.finish('skipped', `${this.checkName} was skipped`, '')
  }

  async cancel(): Promise<void> {
    return this.finish(
      'cancelled',
      `${this.checkName} Check could not be completed`,
      `Something went wrong and the ${this.checkName} could not be completed. Check your action logs for more details.`
    )
  }

  private async finish(
    conclusion: string,
    summary: string,
    text: string
  ): Promise<void> {
    const response = await this.octokit.rest.checks.update({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      check_run_id: this.checkRunId,
      status: 'completed',
      conclusion,
      output: {
        title: this.checkName,
        summary,
        text
      }
    })

    if (response.status !== 200) {
      core.warning(
        `Unexpected status code received when creating check: ${response.status}`
      )
      core.debug(JSON.stringify(response, null, 2))
    } else {
      core.info(`${this.checkName} updated`)
    }
  }
}
