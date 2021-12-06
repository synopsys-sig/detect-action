import {BlackduckApiService} from './blackduck-api'
import {BLACKDUCK_API_TOKEN, BLACKDUCK_URL} from './inputs'

export interface PolicyViolation {
  componentName: string
  versionName: string
  componentIdentifier: string
  violatingPolicyNames: string[]
  errorMessage: string
  _meta: Meta
}

export interface Meta {
  href: string
}

export async function createReport(scanJson: PolicyViolation[]): Promise<string> {
  let message = ''
  if (scanJson.length == 0) {
    message = message.concat('# :white_check_mark: None of your dependencies violate policy!')
  } else {
    message = message.concat('# :warning: Found dependencies violating policy!\r\n')

    let blackduckApiService = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)

    message.concat('| Component | Version | Short Term | Long Term | Violates |\r\n|-----------+---------+------------+-----------+----------|\r\n')
    for (const violation of scanJson) {
      message.concat(await createViolationString(blackduckApiService, violation))
    }
  }
  message = message.concat()

  return message
}

async function createViolationString(blackduckApiService: BlackduckApiService, violation: PolicyViolation): Promise<string> {
  let upgradeGuidance = await blackduckApiService.getUpgradeGuidanceFor(violation.componentIdentifier)
  return `| ${violation.componentName} | ${violation.versionName} | ${upgradeGuidance.shortTerm.versionName} | ${upgradeGuidance.longTerm.versionName} | ${violation.violatingPolicyNames.map(policyName => `${policyName}`).join(', ')} |`
}
