import { IRapidScanResults } from '../blackduck-api'
import { createRapidScanReport, IComponentReport } from './report'

export const TABLE_HEADER = '| Policies Violated | Dependency | License(s) | Vulnerabilities | Short Term Recommended Upgrade | Long Term Recommended Upgrade |\r\n' + '|-|-|-|-|-|-|\r\n'

export async function createRapidScanReportString(policyViolations: IRapidScanResults[], policyCheckWillFail: boolean): Promise<string> {
  let message = ''
  if (policyViolations.length == 0) {
    message = message.concat('# :white_check_mark: None of your dependencies violate policy!')
  } else {
    const violationSymbol = policyCheckWillFail ? ':x:' : ':warning:'
    message = message.concat(`# ${violationSymbol} Found dependencies violating policy!\r\n\r\n`)

    const componentReports = await createRapidScanReport(policyViolations)
    const tableBody = componentReports.map(componentReport => createComponentRow(componentReport)).join('\r\n')
    const reportTable = TABLE_HEADER.concat(tableBody)
    message = message.concat(reportTable)
  }

  return message
}

function createComponentRow(component: IComponentReport): string {
  console.log('component:::::' + JSON.stringify(component))
  //const violatedPolicies = component.violatedPolicies === undefined ? "" : component.violatedPolicies.join('<br/>')
  console.log('component.violatedPolicies::' + component.violatedPolicies)
  const componentInViolation = component?.href ? `[${component.name}](${component.href})` : component.name
  const componentLicenses = component.licenses.map(license => `${license.violatesPolicy ? ':x: &nbsp; ' : ''}[${license.name}](${license.href})`).join('<br/>')
  const vulnerabilities = component.vulnerabilities.map(vulnerability => `${vulnerability.violatesPolicy ? ':x: &nbsp; ' : ''}[${vulnerability.name}](${vulnerability.href})${vulnerability.cvssScore && vulnerability.severity ? ` ${vulnerability.severity}: CVSS ${vulnerability.cvssScore}` : ''}`).join('<br/>')
  const shortTermString = component.shortTermUpgrade ? `[${component.shortTermUpgrade.name}](${component.shortTermUpgrade.href}) (${component.shortTermUpgrade.vulnerabilityCount} known vulnerabilities)` : ''
  const longTermString = component.longTermUpgrade ? `[${component.longTermUpgrade.name}](${component.longTermUpgrade.href}) (${component.longTermUpgrade.vulnerabilityCount} known vulnerabilities)` : ''

  return `| ${componentInViolation} | ${componentLicenses} | ${vulnerabilities} | ${shortTermString} | ${longTermString} |`
}
