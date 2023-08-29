import { GitHubCheck, GitHubCheckCreator } from '../github/check'
import { Input, Inputs } from '../input/inputs'
import * as github from '@actions/github'
import { APPLICATION_NAME, CHECK_NAME } from './constants'
import * as core from '@actions/core'
import { GitHub } from '@actions/github/lib/utils'
import { DetectToolDownloader } from '../detect/detect-tool-downloader'
import { DetectFacade } from '../detect/detect-facade'

export class ActionOrchestrator {
  private gitHubCheck: GitHubCheck | null = null
  private inputs!: Inputs

  private getOctokit(): InstanceType<typeof GitHub> {
    return github.getOctokit(this.inputs.token)
  }

  async execute(inputs: Inputs): Promise<void> {
    this.inputs = inputs
    try {
      const octokit = this.getOctokit()
      const gitHubCheckCreator = new GitHubCheckCreator(octokit, github.context)
      this.gitHubCheck = await gitHubCheckCreator.create(CHECK_NAME)
      await this.doExecute(octokit)
    } catch (e) {
      this.gitHubCheck?.cancel()
      throw e
    }
  }

  private async doExecute(octokit: InstanceType<typeof GitHub>): Promise<void> {
    core.info(`${Input.DETECT_VERSION}: ${this.inputs.detectVersion}.`)
    core.info(
      `${Input.OUTPUT_PATH_OVERRIDE}: ${this.inputs.outputPathOverride}.`
    )
    core.info(`${Input.SCAN_MODE}: ${this.inputs.scanMode}.`)

    const detectPath = await new DetectToolDownloader(
      this.inputs.detectVersion
    ).download()

    const detectFacade = new DetectFacade(
      APPLICATION_NAME,
      this.inputs,
      detectPath,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.gitHubCheck!,
      octokit,
      github.context
    )

    await detectFacade.run()
  }
}
