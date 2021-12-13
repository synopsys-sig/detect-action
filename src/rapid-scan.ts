import {warning} from '@actions/core'
import {IRestResponse} from 'typed-rest-client'
import {BlackduckApiService, cleanUrl, IBlackduckPage, IRapidScanViolation, IUpgradeGuidance} from './blackduck-api'
import {BLACKDUCK_API_TOKEN, BLACKDUCK_URL} from './inputs'

export interface PolicyViolation {
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
    const fullResultsResponse: IRestResponse<IBlackduckPage<IRapidScanViolation>> = await blackduckApiService.get(bearerToken, scanJson[0]._meta.href + '/full-result')
    const fullResults = fullResultsResponse?.result?.items
    if (fullResults === undefined) {
      return Promise.reject(`Could not retrieve Black Duck RAPID scan results from ${scanJson[0]._meta.href + '/full-result'}, response was ${fullResultsResponse.statusCode}`)
    }

    message = message.concat('\r\n')

    const reportTable = await createTable(blackduckApiService, bearerToken, fullResults)
    message = message.concat(reportTable)
  }

  return message
}

async function createTable(blackduckApiService: BlackduckApiService, bearerToken: string, fullResults: IRapidScanViolation[]) {
  let table = '| Policies Violated | Dependency | License(s) | Vulnerabilities | Short Term Recommended Upgrade | Long Term Recommended Upgrade |\r\n|-|-|-|-|-|-|\r\n'

  for (const violation of fullResults) {
    let upgradeGuidanceResponse = await blackduckApiService.getUpgradeGuidanceFor(bearerToken, violation.componentIdentifier).catch(reason => warning(`Could not get upgrade guidance for ${violation.componentIdentifier}: ${reason}`))
    table = table.concat(`${createComponentRow(upgradeGuidanceResponse, violation)}\r\n`)
  }

  return table
}

function createComponentRow(upgradeGuidanceResponse: void | IRestResponse<IUpgradeGuidance>, violation: IRapidScanViolation): string {
  const violatingLicenseNames = violation.policyViolationLicenses.map(license => license.name)
  const violatingVulnerabilityNames = violation.policyViolationVulnerabilities.map(vulnerability => vulnerability.name)

  const componentInViolation = `${violation.componentName} ${violation.versionName}`
  const componentLicenses = violation.allLicenses.map(license => `${violatingLicenseNames.includes(license.name) ? ':x: &nbsp; ' : ''}[${license.name}](${license._meta.href})`).join('<br/>')
  const violatedPolicies = violation.violatingPolicies.map(policy => `${policy.policyName} ${policy.policySeverity === 'UNSPECIFIED' ? '' : `(${policy.policySeverity})`}`).join('<br/>')
  const vulnerabilities = violation.allVulnerabilities.map(vulnerability => `${violatingVulnerabilityNames.includes(vulnerability.name) ? ':x: &nbsp; ' : ''}[${vulnerability.name}](${cleanUrl(BLACKDUCK_URL)}/api/vulnerabilities/${vulnerability.name}) (${vulnerability.vulnSeverity}: CVSS ${vulnerability.overallScore})`).join('<br/>')

  if (upgradeGuidanceResponse === undefined) {
    return `| ${componentInViolation} | ${componentLicenses} | ${violatedPolicies} | ${vulnerabilities} |  |  | `
  }

  let shortTermString = ''
  let longTermString = ''
  const upgradeGuidance = upgradeGuidanceResponse.result
  const shortTerm = upgradeGuidance?.shortTerm
  if (shortTerm !== undefined) {
    const vulnerabilitiesAfterUpgrade = Object.values(shortTerm.vulnerabilityRisk).reduce((accumulatedValues, value) => accumulatedValues + value, 0)
    shortTermString = `[${shortTerm.versionName}](${shortTerm.version}) (${vulnerabilitiesAfterUpgrade} known vulnerabilities)`
  }
  const longTerm = upgradeGuidance?.longTerm
  if (longTerm !== undefined) {
    const vulnerabilitiesAfterUpgrade = Object.values(longTerm.vulnerabilityRisk).reduce((accumulatedValues, value) => accumulatedValues + value, 0)
    longTermString = `[${longTerm.versionName}](${longTerm.version}) (${vulnerabilitiesAfterUpgrade} known vulnerabilities)`
  }

  return `| ${componentInViolation} | ${componentLicenses} | ${violatedPolicies} | ${vulnerabilities} | ${shortTermString} | ${longTermString} |`
}
