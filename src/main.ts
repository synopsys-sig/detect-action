import { info, warning, setFailed, debug } from '@actions/core'
import { create } from '@actions/glob'
import path from 'path'
import fs from 'fs'
import { BlackduckApiService, IBlackduckView, IRapidScanResults } from './blackduck-api'
import { createCheck, GitHubCheck } from './github/check'
import { commentOnPR } from './comment'
import { POLICY_SEVERITY, SUCCESS } from './detect/exit-codes'
import { TOOL_NAME, findOrDownloadDetect, runDetect } from './detect/detect-manager'
import { isPullRequest } from './github/github-context'
import { BLACKDUCK_API_TOKEN, BLACKDUCK_URL, DETECT_TRUST_CERT, DETECT_VERSION, FAIL_ON_ALL_POLICY_SEVERITIES, OUTPUT_PATH_OVERRIDE, SCAN_MODE } from './inputs'
import { createRapidScanReportString } from './detect/reporting'
import { uploadArtifact } from './github/upload-artifacts'
import { CHECK_NAME } from './application-constants'

export async function run() {
  let blackduckPolicyCheck: any
  try {
    blackduckPolicyCheck = await createCheck(CHECK_NAME)
  } catch (error) {
    throw error
  }
  runWithPolicyCheck(blackduckPolicyCheck).catch(unhandledError => {
    debug('Canceling policy check because of an unhandled error.')
    blackduckPolicyCheck.cancelCheck()
    setFailed(`Failed due to an unhandled error: '${unhandledError}'`)
  })
}

export async function runWithPolicyCheck(blackduckPolicyCheck: GitHubCheck): Promise<void> {
  info(`detect-version: ${DETECT_VERSION}`)
  info(`output-path-override: ${OUTPUT_PATH_OVERRIDE}`)
  info(`scan-mode: ${SCAN_MODE}`)

  //Setting process environment for certificate issue fix
  if (!process.env['NODE_TLS_REJECT_UNAUTHORIZED']) {
    info('NODE_TLS_REJECT_UNAUTHORIZED is not set, disabling strict certificate check')
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
  }

  const runnerTemp = process.env.RUNNER_TEMP
  let outputPath = ''
  if (OUTPUT_PATH_OVERRIDE !== '') {
    outputPath = OUTPUT_PATH_OVERRIDE
  } else if (runnerTemp === undefined) {
    setFailed('$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.')
    blackduckPolicyCheck.cancelCheck()
    return
  } else {
    outputPath = path.resolve(runnerTemp, 'blackduck')
  }

  if (SCAN_MODE === 'RAPID') {
    info('Checking that you have at least one enabled policy...')

    const blackduckApiService = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
    const blackDuckBearerToken = await blackduckApiService.getBearerToken()
    let policiesExist: boolean | void = await blackduckApiService.checkIfEnabledBlackduckPoliciesExist(blackDuckBearerToken).catch(reason => {
      setFailed(`Could not verify whether policies existed: ${reason}`)
    })

    if (policiesExist === undefined) {
      debug('Could not determine if policies existed. Canceling policy check.')
      blackduckPolicyCheck.cancelCheck()
      return
    } else if (!policiesExist) {
      setFailed(`Could not run ${TOOL_NAME} using ${SCAN_MODE} scan mode. No enabled policies found on the specified Black Duck server.`)
      return
    } else {
      info(`You have at least one enabled policy, executing ${TOOL_NAME} in ${SCAN_MODE} scan mode...`)
    }
  }

  const detectArgs = [`--blackduck.trust.cert=${DETECT_TRUST_CERT}`, `--blackduck.url=${BLACKDUCK_URL}`, `--blackduck.api.token=${BLACKDUCK_API_TOKEN}`, `--detect.blackduck.scan.mode=${SCAN_MODE}`, `--detect.output.path=${outputPath}`, `--detect.scan.output.path=${outputPath}`]

  const detectPath = await findOrDownloadDetect().catch(reason => {
    setFailed(`Could not download ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (detectPath === undefined) {
    debug(`Could not determine ${TOOL_NAME} path. Canceling policy check.`)
    blackduckPolicyCheck.cancelCheck()
    return
  }

  const detectExitCode = await runDetect(detectPath, detectArgs).catch(reason => {
    setFailed(`Could not execute ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (detectExitCode === undefined) {
    debug(`Could not determine ${TOOL_NAME} exit code. Canceling policy check.`)
    blackduckPolicyCheck.cancelCheck()
    return
  } else if (detectExitCode > 0 && detectExitCode != POLICY_SEVERITY) {
    setFailed(`Detect failed with exit code: ${detectExitCode}. Check the logs for more information.`)
    return
  }

  info(`${TOOL_NAME} executed successfully.`)

  let hasPolicyViolations = false

  if (SCAN_MODE === 'RAPID') {
    info(`${TOOL_NAME} executed in RAPID mode. Beginning reporting...`)

    const jsonGlobber = await create(`${outputPath}/*.json`)
    const scanJsonPaths = await jsonGlobber.glob()
    uploadArtifact('Rapid Scan JSON', outputPath, scanJsonPaths)

    const scanJsonPath = scanJsonPaths[0]
    const rawdata = fs.readFileSync(scanJsonPath)
    const policyViolations = JSON.parse(rawdata.toString()) as IRapidScanResults[]

    hasPolicyViolations = policyViolations.length > 0
    debug(`Policy Violations Present: ${hasPolicyViolations}`)
    info(`Policy Violations Present: ${hasPolicyViolations}`)

    const failureConditionsMet = detectExitCode === POLICY_SEVERITY || FAIL_ON_ALL_POLICY_SEVERITIES
    info(`Policy Violations policyViolations: ${JSON.stringify(policyViolations)}`)
    const rapidScanReport = await createRapidScanReportString(policyViolations, hasPolicyViolations && failureConditionsMet)

    if (isPullRequest()) {
      info('This is a pull request, commenting...')
      commentOnPR(rapidScanReport)
      info('Successfully commented on PR.')
    }

    if (hasPolicyViolations) {
      if (failureConditionsMet) {
        blackduckPolicyCheck.failCheck('Components found that violate your Black Duck Policies!', rapidScanReport)
      } else {
        blackduckPolicyCheck.passCheck('No components violated your BLOCKER or CRITICAL Black Duck Policies!', rapidScanReport)
      }
    } else {
      blackduckPolicyCheck.passCheck('No components found that violate your Black Duck policies!', rapidScanReport)
    }
    info('Reporting complete.')
  } else {
    info(`${TOOL_NAME} executed in ${SCAN_MODE} mode. Skipping policy check.`)
    blackduckPolicyCheck.skipCheck()
  }

  const diagnosticMode = process.env.DETECT_DIAGNOSTIC?.toLowerCase() === 'true'
  const extendedDiagnosticMode = process.env.DETECT_DIAGNOSTIC_EXTENDED?.toLowerCase() === 'true'
  if (diagnosticMode || extendedDiagnosticMode) {
    const diagnosticGlobber = await create(`${outputPath}/runs/*.zip`)
    const diagnosticZip = await diagnosticGlobber.glob()
    uploadArtifact('Detect Diagnostic Zip', outputPath, diagnosticZip)
  }

  if (hasPolicyViolations) {
    warning('Found dependencies violating policy!')
  } else if (detectExitCode > 0) {
    warning('Dependency check failed! See Detect output for more information.')
  } else if (detectExitCode === SUCCESS) {
    info('None of your dependencies violate your Black Duck policies!')
  }
}

run().catch(error => {
  if (error.message != undefined) {
    setFailed(error.message)
  } else {
    setFailed(error)
  }
})
