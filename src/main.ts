import { info, warning, setFailed, debug } from '@actions/core'
import { create } from '@actions/glob'
import path from 'path'
import fs from 'fs'
import { BlackduckApiService } from './blackduck-api'
import { createBlackDuckPolicyCheck, failBlackDuckPolicyCheck, passBlackDuckPolicyCheck, skipBlackDuckPolicyCheck, cancelBlackDuckPolicyCheck } from './check'
import { commentOnPR } from './comment'
import { POLICY_SEVERITY, SUCCESS } from './detect-exit-codes'
import { TOOL_NAME, findOrDownloadDetect, runDetect } from './detect-manager'
import { isPullRequest } from './github-context'
import { BLACKDUCK_API_TOKEN, BLACKDUCK_URL, DETECT_TRUST_CERT, DETECT_VERSION, FAIL_ON_SEVERITIES, OUTPUT_PATH_OVERRIDE, SCAN_MODE } from './inputs'
import { createReport, PolicyViolation } from './rapid-scan'
import { uploadRapidScanJson, uploadDiagnosticZip } from './upload-artifacts'

export async function run() {
  const policyCheckId = await createBlackDuckPolicyCheck()
  runWithPolicyCheck(policyCheckId).catch(unhandledError => {
    debug('Canceling policy check because of an unhandled error.')
    cancelBlackDuckPolicyCheck(policyCheckId)
    setFailed(`Failed due to an unhandled error: '${unhandledError}'`)
  })
}

export async function runWithPolicyCheck(policyCheckId : number): Promise<void> {
  info(`detect-version: ${DETECT_VERSION}`)
  info(`output-path-override: ${OUTPUT_PATH_OVERRIDE}`)
  info(`scan-mode: ${SCAN_MODE}`)

  const runnerTemp = process.env.RUNNER_TEMP
  let outputPath = ''
  if (OUTPUT_PATH_OVERRIDE !== '') {
    outputPath = OUTPUT_PATH_OVERRIDE
  } else if (runnerTemp === undefined) {
    setFailed('$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.')
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  } else {
    outputPath = path.resolve(runnerTemp, 'blackduck')
  }

  info('Checking that you have at least one enabled policy...')

  const blackduckApiService = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
  const blackDuckBearerToken = await blackduckApiService.getBearerToken()
  let policiesExist: boolean | void = await blackduckApiService.checkIfEnabledBlackduckPoliciesExist(blackDuckBearerToken).catch(reason => {
    setFailed(`Could not verify if policies existed: ${reason}`)
  })

  if (policiesExist === undefined) {
    debug('Could not determine if policies existed. Canceling policy check.')
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  if (!policiesExist && SCAN_MODE === 'RAPID') {
    setFailed(`Could not run ${TOOL_NAME} using ${SCAN_MODE} scan mode. No enabled policies found on the specified Black Duck server.`)
    return
  }

  info('You have at least one enabled policy, executing Detect...')

  const detectArgs = [`--blackduck.trust.cert=${DETECT_TRUST_CERT}`, `--blackduck.url=${BLACKDUCK_URL}`, `--blackduck.api.token=${BLACKDUCK_API_TOKEN}`, `--detect.blackduck.scan.mode=${SCAN_MODE}`, `--detect.output.path=${outputPath}`, `--detect.scan.output.path=${outputPath}`, `--detect.policy.check.fail.on.severities=${FAIL_ON_SEVERITIES}`]

  const detectPath = await findOrDownloadDetect().catch(reason => {
    setFailed(`Could not download ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (detectPath === undefined) {
    debug(`Could not determine ${TOOL_NAME} path. Canceling policy check.`)
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  const detectExitCode = await runDetect(detectPath, detectArgs).catch(reason => {
    setFailed(`Could not execute ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (detectExitCode === undefined) {
    debug(`Could not determine ${TOOL_NAME} exit code. Canceling policy check.`)
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  info(`${TOOL_NAME} executed successfully.`)

  if (SCAN_MODE === 'RAPID') {
    info(`${TOOL_NAME} executed in RAPID mode. Beginning reporting...`)

    const jsonGlobber = await create(`${outputPath}/*.json`)
    const scanJsonPaths = await jsonGlobber.glob()
    uploadRapidScanJson(outputPath, scanJsonPaths)

    const scanJsonPath = scanJsonPaths[0]
    const rawdata = fs.readFileSync(scanJsonPath)
    const scanJson = JSON.parse(rawdata.toString()) as PolicyViolation[]
    const rapidScanReport = await createReport(scanJson)

    if (isPullRequest()) {
      info('This is a pull request, commenting...')
      commentOnPR(rapidScanReport)
      info('Successfully commented on PR.')
    }

    if (detectExitCode === POLICY_SEVERITY) {
      failBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    } else {
      passBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    }
    info('Reporting complete.')
  } else {
    info(`${TOOL_NAME} executed in ${SCAN_MODE} mode. Skipping policy check.`)
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
    if (detectExitCode === POLICY_SEVERITY) {
      warning('Found dependencies violating policy!')
    } else {
      warning('Dependency check failed! See Detect output for more information.')
    }
  } else if (detectExitCode === SUCCESS) {
    info('None of your dependencies violate your Black Duck policies!')
  }
}

run()
