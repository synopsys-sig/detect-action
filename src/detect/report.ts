import { warning } from '@actions/core'
import { BlackduckApiService, cleanUrl, IComponentVersion, IRapidScanLicense, IRapidScanResults, IRapidScanVulnerability, IRecommendedVersion, IUpgradeGuidance } from '../blackduck-api'
import { BLACKDUCK_API_TOKEN, BLACKDUCK_URL } from '../inputs'

export interface IComponentReport {
  violatedPolicies: IPolicyReport[]
  name: string
  href?: string
  licenses: ILicenseReport[]
  vulnerabilities: IVulnerabilityReport[]
  shortTermUpgrade?: IUpgradeReport
  longTermUpgrade?: IUpgradeReport
}

export interface IPolicyReport {
  name: string
  severity?: string // Not yet implemented
}

export interface ILicenseReport {
  name: string
  href: string
  violatesPolicy: boolean
}

// Missing no policy violation vulnerabilities
// Available through IComponentVersion.meta.href.vulnerabilities -> GET -> .name ._meta.href .baseScore .severity
export interface IVulnerabilityReport {
  name: string
  href: string
  violatesPolicy: boolean
  cvssScore?: string // Not yet implemented
  severity?: string // Not yet implemented
}

export interface IUpgradeReport {
  name: string
  href: string
  vulnerabilityCount: number
}

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
    }

    const componentReport = createComponentReport(policyViolation, componentVersion, upgradeGuidance)
    rapidScanReport.push(componentReport)
  }

  return rapidScanReport
}

function createComponentReport(violation: IRapidScanResults, componentVersion?: IComponentVersion, upgradeGuidance?: IUpgradeGuidance): IComponentReport {
  return {
    violatedPolicies: violation.violatingPolicyNames.map(policyName => createPolicyReport(policyName)),
    name: `${violation.componentName} ${violation.versionName}`,
    href: componentVersion?.version,
    licenses: createFullLicenseReport(violation.policyViolationLicenses, componentVersion),
    vulnerabilities: violation.policyViolationVulnerabilities.map(violation => createPolicyViolatingVulnerabilityReport(violation)),
    shortTermUpgrade: createUpgradeReport(upgradeGuidance?.shortTerm),
    longTermUpgrade: createUpgradeReport(upgradeGuidance?.longTerm)
  }
}

function createPolicyReport(policyName: string): IPolicyReport {
  return {
    name: policyName
  }
}

function createFullLicenseReport(policyViolatingLicenses: IRapidScanLicense[], componentVersion?: IComponentVersion): ILicenseReport[] {
  let licenseReport = []
  if (componentVersion === undefined) {
    licenseReport = policyViolatingLicenses.map(license => createLicenseReport(license.name, license._meta.href, true))
  } else {
    const violatingPolicyNames = policyViolatingLicenses.map(license => license.name)
    licenseReport = componentVersion.license.licenses.map(license => createLicenseReport(license.name, license.license, violatingPolicyNames.includes(license.name)))
  }

  return licenseReport
}

function createLicenseReport(name: string, href: string, violatesPolicy: boolean): ILicenseReport {
  return {
    name: name,
    href: href,
    violatesPolicy: violatesPolicy
  }
}

function createPolicyViolatingVulnerabilityReport(policyViolatingVulnerability: IRapidScanVulnerability): IVulnerabilityReport {
  return {
    name: policyViolatingVulnerability.name,
    href: `${cleanUrl(BLACKDUCK_URL)}/api/vulnerabilities/${policyViolatingVulnerability.name}`,
    violatesPolicy: true
  }
}

function createUpgradeReport(recommendedVersion?: IRecommendedVersion): IUpgradeReport | undefined {
  if (recommendedVersion === undefined) {
    return undefined
  }

  return {
    name: recommendedVersion.versionName,
    href: recommendedVersion.version,
    vulnerabilityCount: Object.values(recommendedVersion.vulnerabilityRisk).reduce((accumulatedValues, value) => accumulatedValues + value, 0)
  }
}
