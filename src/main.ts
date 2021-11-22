import {info, setFailed} from '@actions/core'
import {create} from '@actions/glob'
import path from 'path'
import fs from 'fs'
import {uploadRapidScanJson, uploadDiagnosticZip} from './upload-artifacts'
import {TOOL_NAME, findOrDownloadDetect, runDetect} from './detect-manager'
import {commentOnPR} from './comment'
import {createReport, PolicyViolation} from './rapid-scan'
import {isPullRequest} from './github-context'
import {createBlackDuckPolicyCheck, failBlackDuckPolicyCheck, passBlackDuckPolicyCheck, skipBlackDuckPolicyCheck} from './check'
import {BLACKDUCK_API_TOKEN, BLACKDUCK_URL, DETECT_VERSION, OUTPUT_PATH_OVERRIDE, SCAN_MODE} from './inputs'
import { BlackduckPolicyChecker } from './policy-checker'

export async function run(): Promise<void> {
  const policyCheckId = await createBlackDuckPolicyCheck()

  const runnerTemp = process.env.RUNNER_TEMP
  let outputPath = ''
  if (OUTPUT_PATH_OVERRIDE !== '') {
    outputPath = OUTPUT_PATH_OVERRIDE
  } else if (runnerTemp === undefined) {
    setFailed('$RUNNER_TEMP is not defined and output-path-override was not set. Cannot determine where to store output files.')
    skipBlackDuckPolicyCheck(policyCheckId)
    return
  } else {
    outputPath = path.resolve(runnerTemp, 'blackduck')
  }

  const blackduckPolicyChecker = new BlackduckPolicyChecker(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
  const policiesExist: boolean = await blackduckPolicyChecker.checkIfEnabledBlackduckPoliciesExist()
  if (!policiesExist && SCAN_MODE === 'RAPID') {
    setFailed(`Could not run ${TOOL_NAME} using ${SCAN_MODE} scan mode. No enabled policies found on the specified Black Duck server.`)
    return
  }

  const detectArgs = ['--blackduck.trust.cert=TRUE', `--blackduck.url=${BLACKDUCK_URL}`, `--blackduck.api.token=${BLACKDUCK_API_TOKEN}`, `--detect.blackduck.scan.mode=${SCAN_MODE}`, `--detect.output.path=${outputPath}`, `--detect.scan.output.path=${outputPath}`]

  const detectPath = await findOrDownloadDetect().catch(reason => {
    setFailed(`Could not download ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (!detectPath) {
    skipBlackDuckPolicyCheck(policyCheckId)
    return
  }

  const detectExitCode = await runDetect(detectPath, detectArgs).catch(reason => {
    setFailed(`Could not execute ${TOOL_NAME} ${DETECT_VERSION}: ${reason}`)
  })

  if (!detectExitCode) {
    skipBlackDuckPolicyCheck(policyCheckId)
    return
  }

  if (SCAN_MODE === 'RAPID') {
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

    if (scanJson.length === 0) {
      passBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
    } else {
      failBlackDuckPolicyCheck(policyCheckId, rapidScanReport)
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
