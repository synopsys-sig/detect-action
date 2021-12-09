import {warning} from '@actions/core'
import {IRestResponse} from 'typed-rest-client'
import {BlackduckApiService, IBlackduckPage, IRapidScanViolation, IUpgradeGuidance} from './blackduck-api'
import {BLACKDUCK_API_TOKEN, BLACKDUCK_URL} from './inputs'

export interface PolicyViolation {
  componentName: string
  versionName: string
  componentIdentifier: string
  _meta: {
    href: string
  }
}

export async function createReport(scanJson: PolicyViolation[]): Promise<string> {
  let message = ''
  if (scanJson.length == 0) {
    message = message.concat('# :white_check_mark: None of your dependencies violate policy!')
  } else {
    message = message.concat('# :x: Found dependencies violating policy!\r\n')

    const blackduckApiService = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
    const bearerToken = await blackduckApiService.getBearerToken()

    message = message.concat('\r\n| Dependency | License(s) | Short Term Fix | Long Term Fix | Violates | Vulnerabilities |\r\n|-|-|-|-|-|-|\r\n')
    const fullResultsResponse: IRestResponse<IBlackduckPage<IRapidScanViolation>> = await blackduckApiService.get(bearerToken, scanJson[0]._meta.href + '/full-result')
    const fullResults = fullResultsResponse?.result?.items
    if (fullResults === undefined) {
      return ''
    }
    for (const violation of fullResults) {
      let upgradeGuidanceResponse = await blackduckApiService.getUpgradeGuidanceFor(bearerToken, violation.componentIdentifier).catch(reason => warning(`Could not get upgrade guidance for ${violation.componentIdentifier}: ${reason}`))
      const componentRow = createViolationString(upgradeGuidanceResponse, violation)
      message = message.concat(`${componentRow}\r\n`)
    }
  }

  return message
}

function createViolationString(upgradeGuidanceResponse: void | IRestResponse<IUpgradeGuidance>, violation: IRapidScanViolation): string {
  const violatingLicenseNames = violation.policyViolationLicenses.map(license => license.name)
  const violatingVulnerabilityNames = violation.policyViolationVulnerabilities.map(vulnerability => vulnerability.name)

  const componentInViolation = `${violation.componentName} ${violation.versionName}`
  const componentLicenses = violation.allLicenses
    .map(license => `${license.name}`)
    .map(licenseName => (violatingLicenseNames.includes(licenseName) ? ':x: &nbsp; ' : '').concat(licenseName))
    .join('<br/>')
  const violatedPolicies = violation.violatingPolicies.map(policy => `${policy.policyName} ${policy.policySeverity === 'UNSPECIFIED' ? '' : `(${policy.policySeverity})`}`).join('<br/>')
  const vulnerabilities = violation.allVulnerabilities.map(vulnerability => `${violatingVulnerabilityNames.includes(vulnerability.name) ? ':x: &nbsp; ' : ''}${vulnerability.name} (${vulnerability.vulnSeverity}: CVSS ${vulnerability.overallScore})`).join('<br/>')
  if (upgradeGuidanceResponse === undefined) {
    return `| ${componentInViolation} | ${componentLicenses} |  |  | ${violatedPolicies} | ${vulnerabilities} |`
  }
  const upgradeGuidance = upgradeGuidanceResponse.result
  return `| ${componentInViolation} | ${componentLicenses} | ${upgradeGuidance?.shortTerm?.versionName ?? ''} | ${upgradeGuidance?.longTerm?.versionName ?? ''} | ${violatedPolicies} | ${vulnerabilities} |`
}
