import * as core from '@actions/core'

export interface Inputs {
  token: string
  blackDuckUrl: string
  blackDuckApiToken: string
  detectVersion?: string
  scanMode: string
  outputPathOverride: string
  detectTrustCertificate: string
}

export enum Input {
  // noinspection SpellCheckingInspection
  GITHUB_TOKEN = 'github-token',
  BLACKDUCK_URL = 'blackduck-url',
  BLACKDUCK_API_TOKEN = 'blackduck-api-token',
  DETECT_VERSION = 'detect-version',
  SCAN_MODE = 'scan-mode',
  OUTPUT_PATH_OVERRIDE = 'output-path-override',
  DETECT_TRUST_CERTIFICATE = 'detect-trust-cert'
}

export function gatherInputs(): Inputs {
  const token = getInputGitHubToken()
  const blackDuckUrl = getInputBlackDuckUrl()
  const blackDuckApiToken = getInputBlackDuckApiToken()
  const detectVersion = getInputDetectVersion()
  const scanMode = getInputScanMode()
  const outputPathOverride = getInputOutputPathOverride()
  const detectTrustCertificate = getInputDetectTrustCertificate()
  return {
    token,
    blackDuckUrl,
    blackDuckApiToken,
    detectVersion,
    scanMode,
    outputPathOverride,
    detectTrustCertificate
  }
}

function getInputGitHubToken(): string {
  return core.getInput(Input.GITHUB_TOKEN, { required: true })
}

function getInputBlackDuckUrl(): string {
  return core.getInput(Input.BLACKDUCK_URL, { required: true })
}

function getInputBlackDuckApiToken(): string {
  return core.getInput(Input.BLACKDUCK_API_TOKEN, { required: true })
}

function getInputDetectVersion(): string | undefined {
  return core.getInput(Input.DETECT_VERSION) ?? undefined
}

function getInputScanMode(): string {
  return core.getInput(Input.SCAN_MODE).toUpperCase()
}

function getInputOutputPathOverride(): string {
  return core.getInput(Input.OUTPUT_PATH_OVERRIDE)
}

function getInputDetectTrustCertificate(): string {
  return core.getInput(Input.DETECT_TRUST_CERTIFICATE)
}
