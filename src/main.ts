import {info, setFailed} from '@actions/core'
import {create} from '@actions/glob'
import path from 'path'
import fs from 'fs'
import {uploadRapidScanJson, uploadDiagnosticZip} from './upload-artifacts'
import {TOOL_NAME, findOrDownloadDetect, runDetect} from './detect-manager'
import {commentOnPR} from './comment'
import {createReport, PolicyViolation} from './rapid-scan'
import {isPullRequest} from './github-context'
import {createBlackDuckPolicyCheck, failBlackDuckPolicyCheck, passBlackDuckPolicyCheck, skipBlackDuckPolicyCheck, cancelBlackDuckPolicyCheck} from './check'
import {BLACKDUCK_API_TOKEN, BLACKDUCK_URL, DETECT_VERSION, OUTPUT_PATH_OVERRIDE, SCAN_MODE} from './inputs'
import {BlackduckApiService} from './blackduck-api'

export async function run(): Promise<void> {
  const policyCheckId = await createBlackDuckPolicyCheck()

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

  const blackduckPolicyChecker = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
  let policiesExist: boolean | void = await blackduckPolicyChecker.checkIfEnabledBlackduckPoliciesExist().catch(reason => {
    setFailed(`Could not verify if policies existed: ${reason}`)
  })

  if (policiesExist === undefined) {
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  if (!policiesExist && SCAN_MODE === 'RAPID') {
    setFailed(`Could not run ${TOOL_NAME} using ${SCAN_MODE} scan mode. No enabled policies found on the specified Black Duck server.`)
    return
  }

  info('You have at least one enabled policy, executing Detect...')

  const detectArgs = ['--blackduck.trust.cert=TRUE', `--blackduck.url=${BLACKDUCK_URL}`, `--blackduck.api.token=${BLACKDUCK_API_TOKEN}`, `--detect.blackduck.scan.mode=${SCAN_MODE}`, `--detect.output.path=${outputPath}`, `--detect.scan.output.path=${outputPath}`]

  const detectPath = await findOrDownloadDetect().catch(reason => {
    setFailed(`Could not download ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (detectPath === undefined) {
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  const detectExitCode = await runDetect(detectPath, detectArgs).catch(reason => {
    setFailed(`Could not execute ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (detectExitCode === undefined) {
    cancelBlackDuckPolicyCheck(policyCheckId)
    return
  }

  info('Detect executed successfully.')

  if (SCAN_MODE === 'RAPID') {
    info('Detect executed in RAPID mode, beginning reporting...')

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

    if (scanJson.length === 0) {
      passBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    } else {
      failBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    }
    info('Reporting complete.')
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
    if (detectExitCode === 3) {
      setFailed('Found dependencies violating policy!')
    } else {
      setFailed('Dependency check failed! See Detect output for more information.')
    }
  } else if (detectExitCode === 0) {
    info('None of your dependencies violate your Black Duck policies!')
  }
}

run()
