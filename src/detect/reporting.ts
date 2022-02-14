import { warning } from '@actions/core'
import { IRestResponse } from 'typed-rest-client'
import { BlackduckApiService, cleanUrl, IBlackduckPage, IComponentVersion, IRapidScanFullResults, IRapidScanResults, IUpgradeGuidance } from '../blackduck-api'
import { BLACKDUCK_API_TOKEN, BLACKDUCK_URL } from '../inputs'
import { IComponentReport } from './report'

export const TABLE_HEADER = '| Policies Violated | Dependency | License(s) | Vulnerabilities | Short Term Recommended Upgrade | Long Term Recommended Upgrade |\r\n' + '|-|-|-|-|-|-|\r\n'

export async function createRapidScanReport(policyViolations: IRapidScanResults[], policyCheckWillFail: boolean): Promise<string> {
  let message = ''
  if (policyViolations.length == 0) {
    message = message.concat('# :white_check_mark: None of your dependencies violate policy!')
  } else {
    const violationSymbol = policyCheckWillFail ? ':x:' : ':warning:'
    message = message.concat(`# ${violationSymbol} Found dependencies violating policy!\r\n`)

    const blackduckApiService = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
    const bearerToken = await blackduckApiService.getBearerToken()
    const fullResultsResponse: IRestResponse<IBlackduckPage<IRapidScanFullResults>> = await blackduckApiService.get(bearerToken, policyViolations[0]._meta.href + '/full-result')
    const fullResults = fullResultsResponse?.result?.items
    if (fullResults === undefined || fullResults.length == 0) {
      return Promise.reject(`Could not retrieve Black Duck RAPID scan results from ${policyViolations[0]._meta.href + '/full-result'}, response was ${fullResultsResponse.statusCode}`)
    }

    message = message.concat('\r\n')

    const reportTable = await createTable(blackduckApiService, bearerToken, fullResults)
    message = message.concat(reportTable)
  }

  return message
}

export async function createTable(blackduckApiService: BlackduckApiService, bearerToken: string, fullResults: IRapidScanFullResults[]): Promise<string> {
  let table = TABLE_HEADER

  for (const violation of fullResults) {
    if (violation.violatingPolicies.length > 0) {
      const componentVersionResponse = await blackduckApiService.getComponentsMatching(bearerToken, violation.componentIdentifier)
      const componentVersion = componentVersionResponse?.result?.items[0]

      let upgradeGuidance = null
      if (componentVersion !== undefined) {
        const upgradeGuidanceResponse = await blackduckApiService.getUpgradeGuidanceFor(bearerToken, componentVersion).catch(reason => warning(`Could not get upgrade guidance for ${violation.componentIdentifier}: ${reason}`))
        upgradeGuidance = upgradeGuidanceResponse?.result
      }
      table = table.concat(`${createComponentRowFromFullResults(componentVersion, upgradeGuidance, violation)}\r\n`)
    }
  }

  return table
}

function createComponentRow(component: IComponentReport): string {
  const violatedPolicies = component.violatedPolicies.map(policy => `${policy.name} ${policy.severity === 'UNSPECIFIED' ? '' : `(${policy.severity})`}`).join('<br/>')
  const componentInViolation = component?.href ? `[${component.name}](${component.href})` : component.name
  const componentLicenses = component.licenses.map(license => `${license.violatesPolicy ? ':x: &nbsp; ' : ''}[${license.name}](${license.href})`).join('<br/>')
  const vulnerabilities = component.vulnerabilities.map(vulnerability => `${vulnerability.violatesPolicy ? ':x: &nbsp; ' : ''}[${vulnerability.name}](${vulnerability.href})${vulnerability.cvssScore && vulnerability.severity ? ` ${vulnerability.severity}: CVSS ${vulnerability.cvssScore}` : ''}`).join('<br/>')
  const shortTermString = component.shortTermUpgrade ? `[${component.shortTermUpgrade.name}](${component.shortTermUpgrade.href}) (${component.shortTermUpgrade.vulnerabilityCount} known vulnerabilities)` : ''
  const longTermString = component.longTermUpgrade ? `[${component.longTermUpgrade.name}](${component.longTermUpgrade.href}) (${component.longTermUpgrade.vulnerabilityCount} known vulnerabilities)` : ''

  return `| ${violatedPolicies} | ${componentInViolation} | ${componentLicenses} | ${vulnerabilities} | ${shortTermString} | ${longTermString} |`
}

function createComponentRowFromFullResults(componentVersion: IComponentVersion | undefined, upgradeGuidance: IUpgradeGuidance | null | undefined, violation: IRapidScanFullResults): string {
  const violatingLicenseNames = violation.policyViolationLicenses.map(license => license.name)
  const violatingVulnerabilityNames = violation.policyViolationVulnerabilities.map(vulnerability => vulnerability.name)

  const violatedPolicies = violation.violatingPolicies.map(policy => `${policy.policyName} ${policy.policySeverity === 'UNSPECIFIED' ? '' : `(${policy.policySeverity})`}`).join('<br/>')
  let componentInViolation = `${violation.componentName} ${violation.versionName}`
  if (componentVersion?.version !== undefined) {
    componentInViolation = `[${violation.componentName} ${violation.versionName}](${componentVersion?.version})`
  }
  const componentLicenses = violation.allLicenses.map(license => `${violatingLicenseNames.includes(license.name) ? ':x: &nbsp; ' : ''}[${license.name}](${license._meta.href}/text)`).join('<br/>')
  const vulnerabilities = violation.allVulnerabilities.map(vulnerability => `${violatingVulnerabilityNames.includes(vulnerability.name) ? ':x: &nbsp; ' : ''}[${vulnerability.name}](${cleanUrl(BLACKDUCK_URL)}/api/vulnerabilities/${vulnerability.name}) (${vulnerability.vulnSeverity}: CVSS ${vulnerability.overallScore})`).join('<br/>')

  if (upgradeGuidance === undefined || upgradeGuidance === null) {
    return `| ${violatedPolicies} | ${componentInViolation} | ${componentLicenses}  | ${vulnerabilities} |  |  | `
  }

  let shortTermString = ''
  let longTermString = ''
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

  return `| ${violatedPolicies} | ${componentInViolation} | ${componentLicenses} | ${vulnerabilities} | ${shortTermString} | ${longTermString} |`
}
