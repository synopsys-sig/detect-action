import { warning } from '@actions/core'
import { BlackduckApiService, IComponentVersion, IComponentVulnerability, IRapidScanLicense, IRapidScanResults, IRapidScanVulnerability, IRecommendedVersion, IUpgradeGuidance } from '../blackduck-api'
import { BLACKDUCK_API_TOKEN, BLACKDUCK_URL } from '../inputs'

export async function createRapidScanReport(policyViolations: IRapidScanResults[], blackduckApiService?: BlackduckApiService): Promise<IComponentReport[]> {
  const rapidScanReport: IComponentReport[] = []

  if (blackduckApiService === undefined) {
    blackduckApiService = new BlackduckApiService(BLACKDUCK_URL, BLACKDUCK_API_TOKEN)
  }

  const bearerToken = await blackduckApiService.getBearerToken()

  for (const policyViolation of policyViolations) {
    const componentIdentifier = policyViolation.componentIdentifier
    const componentVersionResponse = await blackduckApiService.getComponentsMatching(bearerToken, componentIdentifier)
    const componentVersion = componentVersionResponse?.result?.items[0]

    let upgradeGuidance = undefined
    let vulnerabilities = undefined
    if (componentVersion !== undefined) {
      upgradeGuidance = await blackduckApiService
        .getUpgradeGuidanceFor(bearerToken, componentVersion)
        .then(response => {
          if (response.result === null) {
            warning(`Could not get upgrade guidance for ${componentIdentifier}: The upgrade guidance result was empty`)
            return undefined
          }

          return response.result
        })
        .catch(reason => {
          warning(`Could not get upgrade guidance for ${componentIdentifier}: ${reason}`)
          return undefined
        })

      const vulnerabilityResponse = await blackduckApiService.getComponentVulnerabilties(bearerToken, componentVersion)
      vulnerabilities = vulnerabilityResponse?.result?.items
    }

    const componentReport = createComponentReport(policyViolation, componentVersion, upgradeGuidance, vulnerabilities)
    rapidScanReport.push(componentReport)
  }

  return rapidScanReport
}
export interface IComponentReport {
  violatedPolicies: IPolicyReport[]
  name: string
  href?: string
  licenses: ILicenseReport[]
  vulnerabilities: IVulnerabilityReport[]
  shortTermUpgrade?: IUpgradeReport
  longTermUpgrade?: IUpgradeReport
}

export function createComponentReport(violation: IRapidScanResults, componentVersion?: IComponentVersion, upgradeGuidance?: IUpgradeGuidance, vulnerabilities?: IComponentVulnerability[]): IComponentReport {
  return {
    violatedPolicies: violation.violatingPolicyNames.map(policyName => createPolicyReport(policyName)),
    name: `${violation.componentName} ${violation.versionName}`,
    href: componentVersion?.version,
    licenses: createComponentLicenseReports(violation.policyViolationLicenses, componentVersion),
    vulnerabilities: createComponentVulnerabilityReports(violation.policyViolationVulnerabilities, vulnerabilities),
    shortTermUpgrade: createUpgradeReport(upgradeGuidance?.shortTerm),
    longTermUpgrade: createUpgradeReport(upgradeGuidance?.longTerm)
  }
}

export function createComponentLicenseReports(policyViolatingLicenses: IRapidScanLicense[], componentVersion?: IComponentVersion): ILicenseReport[] {
  let licenseReport = []
  if (componentVersion === undefined) {
    licenseReport = policyViolatingLicenses.map(license => createLicenseReport(license.name, license._meta.href, true))
  } else {
    const violatingPolicyLicenseNames = policyViolatingLicenses.map(license => license.name)
    licenseReport = componentVersion.license.licenses.map(license => createLicenseReport(license.name, license.license, violatingPolicyLicenseNames.includes(license.name)))
  }

  return licenseReport
}

export function createComponentVulnerabilityReports(policyViolatingVulnerabilities: IRapidScanVulnerability[], componentVulnerabilities?: IComponentVulnerability[]): IVulnerabilityReport[] {
  let vulnerabilityReport = []
  if (componentVulnerabilities === undefined) {
    vulnerabilityReport = policyViolatingVulnerabilities.map(vulnerability => createVulnerabilityReport(vulnerability.name, true))
  } else {
    const violatingPolicyVulnerabilityNames = policyViolatingVulnerabilities.map(vulnerability => vulnerability.name)
    vulnerabilityReport = componentVulnerabilities.map(vulnerability => createVulnerabilityReport(vulnerability.vulnerabilityName, violatingPolicyVulnerabilityNames.includes(vulnerability.vulnerabilityName), vulnerability._meta.href, vulnerability.baseScore, vulnerability.severity))
  }

  return vulnerabilityReport
}

export interface IPolicyReport {
  name: string
  severity?: string // Not yet implemented
}

export function createPolicyReport(policyName: string, severity?: string): IPolicyReport {
  return {
    name: policyName,
    severity: severity
  }
}

export interface ILicenseReport {
  name: string
  href: string
  violatesPolicy: boolean
}

export function createLicenseReport(name: string, href: string, violatesPolicy: boolean): ILicenseReport {
  return {
    name: name,
    href: href,
    violatesPolicy: violatesPolicy
  }
}

export interface IVulnerabilityReport {
  name: string
  violatesPolicy: boolean
  href?: string
  cvssScore?: number
  severity?: string
}

export function createVulnerabilityReport(name: string, violatesPolicy: boolean, href?: string, cvssScore?: number, severity?: string): IVulnerabilityReport {
  return {
    name: name,
    violatesPolicy: violatesPolicy,
    href: href,
    cvssScore: cvssScore,
    severity: severity
  }
}

export interface IUpgradeReport {
  name: string
  href: string
  vulnerabilityCount: number
}

export function createUpgradeReport(recommendedVersion?: IRecommendedVersion): IUpgradeReport | undefined {
  if (recommendedVersion === undefined) {
    return undefined
  }

  return {
    name: recommendedVersion.versionName,
    href: recommendedVersion.version,
    vulnerabilityCount: Object.values(recommendedVersion.vulnerabilityRisk).reduce((accumulatedValues, value) => accumulatedValues + value, 0)
  }
}
