import { getInput } from '@actions/core'

export const GITHUB_TOKEN = getInput('github-token')
export const BLACKDUCK_URL = getInput('blackduck-url')
export const BLACKDUCK_API_TOKEN = getInput('blackduck-api-token')
export const DETECT_VERSION = getInput('detect-version')
export const SCAN_MODE = getInput('scan-mode').toUpperCase()
export const FAIL_ON_ALL_POLICY_SEVERITIES = getInput('fail-on-all-policy-severities')
export const OUTPUT_PATH_OVERRIDE = getInput('output-path-override')
export const DETECT_TRUST_CERT = getInput('detect-trust-cert')
