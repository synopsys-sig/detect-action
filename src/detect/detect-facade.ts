import { Inputs } from '../input/inputs'
import { GitHubCheck } from '../github/check'
import { BlackDuckApiService } from '../blackduck/blackduck-api-service'
import * as glob from '@actions/glob'
import * as core from '@actions/core'
import { TOOL_NAME } from './detect-tool-downloader'
import {
  DetectEnvironmentProperties,
  RAPID_SCAN,
  RUNNER_DEFAULT_OUTPUT_DIRECTORY
} from './constants'
import { uploadArtifact } from '../github/upload-artifacts'
import { ExitCode, getExitCodeName } from './exit-code'
import { Detect } from './detect'
import { Output } from '../output/outputs'
import path from 'path'
import { BlackDuckReportGenerator } from '../report/blackduck-report-generator'
import { CommentReporter } from '../report/comment-reporter'
import { CheckReporter } from '../report/check-reporter'
import { GitHub } from '@actions/github/lib/utils'
import { GitHubPRCommenter } from '../github/comment'
import { BlackDuckScanReportGenerator } from '../report/blackduck-scan-report-generator'
import { ActionsEnvironmentProperties } from '../action/constants'
import { ExtendedContext } from '../github/extended-context'

const MAX_REPORT_SIZE = 65535

export class DetectFacade {
  private readonly applicationName: string
  private readonly detectPath: string
  private readonly inputs: Inputs
  private readonly gitHubCheck: GitHubCheck
  private readonly blackDuckApiService: BlackDuckApiService
  private readonly context: ExtendedContext

  private readonly blackDuckReportGenerator: BlackDuckReportGenerator
  private readonly commentReporter: CommentReporter
  private readonly checkReporter: CheckReporter

  constructor(
    applicationName: string,
    inputs: Inputs,
    detectPath: string,
    gitHubCheck: GitHubCheck,
    octokit: InstanceType<typeof GitHub>,
    context: ExtendedContext
  ) {
    this.applicationName = applicationName
    this.inputs = inputs
    this.detectPath = detectPath
    this.gitHubCheck = gitHubCheck
    this.blackDuckApiService = new BlackDuckApiService(
      this.inputs.blackDuckUrl,
      this.inputs.blackDuckApiToken
    )
    this.context = context
    this.commentReporter = new CommentReporter(
      new GitHubPRCommenter(this.applicationName, octokit, context)
    )
    this.blackDuckReportGenerator = new BlackDuckReportGenerator(
      new BlackDuckScanReportGenerator(this.blackDuckApiService)
    )
    this.checkReporter = new CheckReporter(this.gitHubCheck)
  }

  private setNodeTlsRejectUnauthorized(): void {
    //Setting process environment for certificate issue fix
    if (
      !process.env[DetectEnvironmentProperties.NODE_TLS_REJECT_UNAUTHORIZED]
    ) {
      core.info(
        `${DetectEnvironmentProperties.NODE_TLS_REJECT_UNAUTHORIZED} is not set, disabling strict certificate check.`
      )
      process.env[DetectEnvironmentProperties.NODE_TLS_REJECT_UNAUTHORIZED] =
        '0'
    }
  }

  private getOutputPath(): string {
    const runnerTemp = process.env[ActionsEnvironmentProperties.RUNNER_TEMP]
    let outputPath: string | undefined = undefined
    if (this.inputs.outputPathOverride) {
      outputPath = this.inputs.outputPathOverride
    } else if (runnerTemp) {
      outputPath = path.resolve(runnerTemp, RUNNER_DEFAULT_OUTPUT_DIRECTORY)
    } else {
      throw new Error(
        '$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.'
      )
    }
    return outputPath
  }

  private getDetectArguments(outputPath: string): string[] {
    // noinspection SpellCheckingInspection
    const detectArguments = [
      `--blackduck.trust.cert=${this.inputs.detectTrustCertificate}`,
      `--blackduck.url=${this.inputs.blackDuckUrl}`,
      `--blackduck.api.token=${this.inputs.blackDuckApiToken}`,
      `--detect.blackduck.scan.mode=${this.inputs.scanMode}`,
      `--detect.output.path=${outputPath}`,
      `--detect.scan.output.path=${outputPath}`
    ]
    if (core.isDebug()) {
      detectArguments.push('--logging.level.com.synopsys.integration=DEBUG')
    }
    return detectArguments
  }

  private enableDiagnosticModeIfDebugEnabled(): void {
    if (core.isDebug()) {
      process.env[DetectEnvironmentProperties.DETECT_DIAGNOSTIC] = 'true'
    }
  }

  private isDiagnosticModeEnabled(): boolean {
    const diagnosticMode =
      process.env[
        DetectEnvironmentProperties.DETECT_DIAGNOSTIC
      ]?.toLowerCase() === 'true'
    const extendedDiagnosticMode =
      process.env[
        DetectEnvironmentProperties.DETECT_DIAGNOSTIC_EXTENDED
      ]?.toLowerCase() === 'true'
    return diagnosticMode || extendedDiagnosticMode
  }

  private async getDiagnosticFilesPaths(outputPath: string): Promise<string[]> {
    // noinspection SpellCheckingInspection
    const diagnosticGlobber = await glob.create(`${outputPath}/runs/*.zip`)
    return await diagnosticGlobber.glob()
  }

  private async getResultsPaths(outputPath: string): Promise<string[]> {
    // noinspection SpellCheckingInspection
    const jsonGlobber = await glob.create(`${outputPath}/*.json`)
    const scanJsonPaths = await jsonGlobber.glob()
    if (!scanJsonPaths || scanJsonPaths.length <= 0) {
      throw new Error(`No scan results found in ${outputPath}`)
    }
    return scanJsonPaths
  }

  private async processRapidScanResult(
    failureConditionsMet: boolean,
    outputPath: string
  ): Promise<boolean> {
    core.info(
      `${TOOL_NAME} executed in ${RAPID_SCAN} mode. Beginning reporting...`
    )

    const scanJsonPaths = await this.getResultsPaths(outputPath)
    await uploadArtifact('Rapid Scan JSON', outputPath, scanJsonPaths)

    const reportResult = await this.blackDuckReportGenerator.generateReport(
      scanJsonPaths[0],
      {
        failureConditionsMet,
        maxSize: MAX_REPORT_SIZE
      }
    )

    const commentInContext =
      (this.inputs.commentPrOnSuccess && !reportResult.failed) ||
      reportResult.failed

    if (this.context.isPullRequest() && commentInContext) {
      core.info('Commenting pull request...')
      await this.commentReporter.report(reportResult)
      core.info('Successfully commented on PR.')
    }

    const hasPolicyViolations = reportResult.hasPolicyViolations
    core.debug(`Policy Violations Present: ${hasPolicyViolations}.`)

    await this.checkReporter.report(reportResult)

    core.info('Reporting complete.')

    return hasPolicyViolations
  }

  private async processDetectResult(
    outputPath: string,
    failureConditionsMet: boolean
  ): Promise<boolean> {
    core.info(`${TOOL_NAME} executed successfully.`)

    let hasPolicyViolations = false

    if (this.inputs.scanMode === RAPID_SCAN) {
      hasPolicyViolations = await this.processRapidScanResult(
        failureConditionsMet,
        outputPath
      )
    }

    if (this.isDiagnosticModeEnabled()) {
      const diagnosticZip = await this.getDiagnosticFilesPaths(outputPath)
      await uploadArtifact('Detect Diagnostic Zip', outputPath, diagnosticZip)
    }

    return hasPolicyViolations
  }

  private async hasEnabledBlackDuckPolicy(): Promise<boolean> {
    core.info('Checking that you have at least one enabled policy...')

    return this.blackDuckApiService.checkIfEnabledBlackDuckPoliciesExist()
  }

  private async assertEnabledBlackDuckPolicy(): Promise<void> {
    const policiesExist = await this.hasEnabledBlackDuckPolicy()

    if (!policiesExist) {
      throw new Error(
        `Could not run ${TOOL_NAME} using ${this.inputs.scanMode} scan mode. No enabled policies found on the specified Black Duck server.`
      )
    }

    core.info(
      `You have at least one enabled policy, executing ${TOOL_NAME} in ${this.inputs.scanMode} scan mode...`
    )
  }

  private async verifyBlackDuckPolicy(): Promise<void> {
    if (this.inputs.scanMode === RAPID_SCAN) {
      core.info(
        `${TOOL_NAME} executed in ${RAPID_SCAN} mode. Requires policy check.`
      )
      await this.assertEnabledBlackDuckPolicy()
    } else {
      core.info(
        `${TOOL_NAME} executed in ${this.inputs.scanMode} mode. Skipping policy check.`
      )
      await this.gitHubCheck.skip()
    }
  }

  async run(): Promise<void> {
    this.enableDiagnosticModeIfDebugEnabled()
    this.setNodeTlsRejectUnauthorized()

    const outputPath = this.getOutputPath()

    await this.verifyBlackDuckPolicy()

    const detect = new Detect(this.detectPath)

    const detectExitCode = await detect.run(this.getDetectArguments(outputPath))

    const exitCodeName = getExitCodeName(detectExitCode)

    core.setOutput(Output.DETECT_EXIT_CODE, detectExitCode)
    core.setOutput(Output.DETECT_EXIT_CODE_NAME, exitCodeName)

    core.info(
      `${TOOL_NAME} exited with code ${detectExitCode} - ${exitCodeName}.`
    )

    const isSuccessOrPolicyFailure =
      detectExitCode === ExitCode.SUCCESS ||
      detectExitCode === ExitCode.FAILURE_POLICY_VIOLATION

    if (isSuccessOrPolicyFailure) {
      const hasPolicyViolations = await this.processDetectResult(
        outputPath,
        detectExitCode === ExitCode.FAILURE_POLICY_VIOLATION ||
          this.inputs.failOnAllPolicySeverities
      )

      if (hasPolicyViolations) {
        core.warning('Found dependencies violating policy!')
      } else if (detectExitCode === ExitCode.SUCCESS) {
        core.info('None of your dependencies violate your Black Duck policies!')
      } else {
        core.warning(
          'Dependency check failed! See Detect output for more information.'
        )
      }
    }

    const isFailureAndNotRapidScan =
      detectExitCode !== ExitCode.SUCCESS && this.inputs.scanMode !== RAPID_SCAN

    const isFailureAndFailIfDetectFails =
      detectExitCode !== ExitCode.SUCCESS && this.inputs.failIfDetectFails

    if (
      isFailureAndFailIfDetectFails ||
      !isSuccessOrPolicyFailure ||
      isFailureAndNotRapidScan
    ) {
      throw new Error(
        `Detect failed with exit code: ${detectExitCode} - ${getExitCodeName(
          detectExitCode
        )}. Check the logs for more information.`
      )
    }
  }
}
