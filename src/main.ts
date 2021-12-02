import * as core from '@actions/core'
import { create } from '@actions/glob'
import path from 'path'
import fs from 'fs'
import { uploadRapidScanJson, uploadDiagnosticZip } from './upload-artifacts'
import { TOOL_NAME, findOrDownloadDetect, runDetect } from './detect-manager'
import { commentOnPR } from './comment'
import { createReport, PolicyViolation } from './rapid-scan'
import { isPullRequest } from './github-context'
import { createBlackDuckPolicyCheck, failBlackDuckPolicyCheck, passBlackDuckPolicyCheck, skipBlackDuckPolicyCheck, cancelBlackDuckPolicyCheck } from './check'
import * as inputs from './inputs'
import { BlackduckPolicyChecker } from './policy-checker'
import * as detectExitCodes from './detect-exit-codes'

export async function run(): Promise<void> {
  const policyCheckId = await createBlackDuckPolicyCheck()

  const runnerTemp = process.env.RUNNER_TEMP
  let outputPath = ''
  if (inputs.OUTPUT_PATH_OVERRIDE !== '') {
    outputPath = inputs.OUTPUT_PATH_OVERRIDE
  } else if (runnerTemp === undefined) {
    core.setFailed('$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.')
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  } else {
    outputPath = path.resolve(runnerTemp, 'blackduck')
  }

  const blackduckPolicyChecker = new BlackduckPolicyChecker(inputs.BLACKDUCK_URL, inputs.BLACKDUCK_API_TOKEN)
  let policiesExist: boolean | void = await blackduckPolicyChecker.checkIfEnabledBlackduckPoliciesExist().catch(reason => {
    core.setFailed(`Could not verify if policies existed: ${reason}`)
  })

  if (policiesExist === undefined) {
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  if (!policiesExist && inputs.SCAN_MODE === 'RAPID') {
    core.setFailed(`Could not run ${TOOL_NAME} using ${inputs.SCAN_MODE} scan mode. No enabled policies found on the specified Black Duck server.`)
    return
  }

  const detectArgs = [`--blackduck.trust.cert=${inputs.DETECT_TRUST_CERT}`, `--blackduck.url=${inputs.BLACKDUCK_URL}`, `--blackduck.api.token=${inputs.BLACKDUCK_API_TOKEN}`, `--detect.blackduck.scan.mode=${inputs.SCAN_MODE}`, `--detect.output.path=${outputPath}`, `--detect.scan.output.path=${outputPath}`, `--detect.policy.check.fail.on.severities=${inputs.FAIL_ON_SEVERITIES}`]

  const detectPath = await findOrDownloadDetect().catch(reason => {
    core.setFailed(`Could not download ${TOOL_NAME} ${inputs.DETECT_VERSION}: ${reason}`)
  })

  if (!detectPath) {
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  const detectExitCode = await runDetect(detectPath, detectArgs).catch(reason => {
    core.setFailed(`Could not execute ${TOOL_NAME} ${inputs.DETECT_VERSION}: ${reason}`)
  })

  if (!detectExitCode) {
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  if (inputs.SCAN_MODE === 'RAPID') {
    const jsonGlobber = await create(`${outputPath}/*.json`)
    const scanJsonPaths = await jsonGlobber.glob()
    uploadRapidScanJson(outputPath, scanJsonPaths)

    const scanJsonPath = scanJsonPaths[0]
    const rawdata = fs.readFileSync(scanJsonPath)
    const scanJson = JSON.parse(rawdata.toString()) as PolicyViolation[]
    const rapidScanReport = await createReport(scanJson)

    if (isPullRequest()) {
      commentOnPR(rapidScanReport)
    }

    if (detectExitCode === detectExitCodes.POLICY_SEVERITY) {
      failBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    } else {
      passBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    }
  } else {
    // TODO: Implement policy check for non-rapid scan
    skipBlackDuckPolicyCheck(policyCheckId)
  }

  const diagnosticMode = process.env.DETECT_DIAGNOSTIC?.toLowerCase() === 'true'
  const extendedDiagnosticMode = process.env.DETECT_DIAGNOSTIC_EXTENDED?.toLowerCase() === 'true'
  if (diagnosticMode || extendedDiagnosticMode) {
    const diagnosticGlobber = await create(`${outputPath}/runs/*.zip`)
    const diagnosticZip = await diagnosticGlobber.glob()
    uploadDiagnosticZip(outputPath, diagnosticZip)
  }

  if (detectExitCode > 0) {
    if (detectExitCode === detectExitCodes.POLICY_SEVERITY) {
      core.warning('Found dependencies violating policy!')
    } else {
      core.warning('Dependency check failed! See Detect output for more information.')
    }
  } else if (detectExitCode === detectExitCodes.SUCCESS) {
    core.info('None of your dependencies violate your Black Duck policies!')
  }
}

run()
