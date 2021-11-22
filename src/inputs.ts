import {getInput} from '@actions/core'

export const GITHUB_TOKEN = getInput('github-token')
export const BLACKDUCK_URL = getInput('blackduck-url')
export const BLACKDUCK_API_TOKEN = getInput('blackduck-api-token')
export const DETECT_VERSION = getInput('detect-version')
export const SCAN_MODE = getInput('scan-mode').toUpperCase()
export const OUTPUT_PATH_OVERRIDE = getInput('output-path-override')
