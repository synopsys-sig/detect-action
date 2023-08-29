import { ReportGenerator } from './report-generator'
import {
  BlackDuckScanReport,
  IComponentReport,
  ILicenseReport,
  IUpgradeReport,
  IVulnerabilityReport
} from '../model/report-line'
import { BlackDuckApiService } from '../blackduck/blackduck-api-service'
import fs from 'fs/promises'
import {
  ComponentVersionUpgradeGuidanceTermView,
  ComponentVersionUpgradeGuidanceView,
  ComponentVersionView,
  DeveloperScansScanItemsPolicyViolationView,
  DeveloperScansScanView,
  VulnerabilityView
} from '../model/blackduck'
import * as core from '@actions/core'

const FILE_ENCODING = 'utf-8'

export class BlackDuckScanReportGenerator
  implements ReportGenerator<void, BlackDuckScanReport>
{
  private readonly blackDuckApiService: BlackDuckApiService

  constructor(blackDuckApiService: BlackDuckApiService) {
    this.blackDuckApiService = blackDuckApiService
  }

  async generateReport(path: string): Promise<BlackDuckScanReport> {
    const data = await fs.readFile(path, FILE_ENCODING)
    const policyViolations = JSON.parse(data) as DeveloperScansScanView[]
    const componentReports = await this.createRapidScanReport(policyViolations)
    return {
      hasPolicyViolations: policyViolations.length > 0,
      reports: componentReports
    }
  }

  private async createSingleRapidScanReport(
    policyViolation: DeveloperScansScanView
  ): Promise<IComponentReport> {
    const componentIdentifier = policyViolation.componentIdentifier
    const componentVersion =
      await this.blackDuckApiService.getComponentVersionMatching(
        componentIdentifier
      )

    let upgradeGuidance = undefined
    let vulnerabilities = undefined
    if (componentVersion !== null) {
      try {
        const upgradeGuidanceResponse =
          await this.blackDuckApiService.getUpgradeGuidanceFor(componentVersion)
        if (upgradeGuidanceResponse.result === null) {
          core.warning(
            `Could not get upgrade guidance for ${componentIdentifier}: The upgrade guidance result was empty.`
          )
        } else {
          upgradeGuidance = upgradeGuidanceResponse.result
        }
      } catch (e) {
        core.warning(
          `Could not get upgrade guidance for ${componentIdentifier}: ${e}.`
        )
      }

      const vulnerabilityResponse =
        await this.blackDuckApiService.getComponentVulnerabilities(
          componentVersion
        )
      vulnerabilities = vulnerabilityResponse?.result?.items
    }

    const componentVersionOrUndefined =
      componentVersion === null ? undefined : componentVersion
    return this.createComponentReport(
      policyViolation,
      componentVersionOrUndefined,
      upgradeGuidance,
      vulnerabilities
    )
  }

  private async createRapidScanReport(
    policyViolations: DeveloperScansScanView[]
  ): Promise<IComponentReport[]> {
    const rapidScanReport: IComponentReport[] = []

    for (const policyViolation of policyViolations) {
      const componentReport =
        await this.createSingleRapidScanReport(policyViolation)
      rapidScanReport.push(componentReport)
    }

    return rapidScanReport
  }

  private createComponentReport(
    violation: DeveloperScansScanView,
    componentVersion?: ComponentVersionView,
    upgradeGuidance?: ComponentVersionUpgradeGuidanceView,
    vulnerabilities?: VulnerabilityView[]
  ): IComponentReport {
    return {
      violatedPolicies: violation.violatingPolicies.map(x => x.policyName),
      name: `${violation.componentName} ${violation.versionName}`,
      href: componentVersion?._meta.href,
      licenses: this.createComponentLicenseReports(
        violation.policyViolationLicenses,
        componentVersion
      ),
      vulnerabilities: this.createComponentVulnerabilityReports(
        violation.policyViolationVulnerabilities,
        vulnerabilities
      ),
      shortTermUpgrade: this.createUpgradeReport(upgradeGuidance?.shortTerm),
      longTermUpgrade: this.createUpgradeReport(upgradeGuidance?.longTerm)
    }
  }

  private createComponentLicenseReports(
    policyViolatingLicenses: DeveloperScansScanItemsPolicyViolationView[],
    componentVersion?: ComponentVersionView
  ): ILicenseReport[] {
    let licenseReport
    if (componentVersion === undefined) {
      licenseReport = policyViolatingLicenses.map(license =>
        this.createLicenseReport(license.name, '', true)
      )
    } else {
      const violatingPolicyLicenseNames = policyViolatingLicenses.map(
        license => license.name
      )
      licenseReport = componentVersion.license.licenses.map(license =>
        this.createLicenseReport(
          license.name,
          license.license,
          violatingPolicyLicenseNames.includes(license.name)
        )
      )
    }

    return licenseReport
  }

  private createComponentVulnerabilityReports(
    policyViolatingVulnerabilities: DeveloperScansScanItemsPolicyViolationView[],
    componentVulnerabilities?: VulnerabilityView[]
  ): IVulnerabilityReport[] {
    let vulnerabilityReport
    if (componentVulnerabilities === undefined) {
      vulnerabilityReport = policyViolatingVulnerabilities.map(vulnerability =>
        this.createVulnerabilityReport(vulnerability.name, true)
      )
    } else {
      const violatingPolicyVulnerabilityNames =
        policyViolatingVulnerabilities.map(vulnerability => vulnerability.name)
      vulnerabilityReport = componentVulnerabilities.map(vulnerability => {
        const componentVulnerabilitiesBaseScore = vulnerability.useCvss3
          ? vulnerability.cvss3.baseScore
          : vulnerability.cvss2.baseScore
        return this.createVulnerabilityReport(
          vulnerability.name,
          violatingPolicyVulnerabilityNames.includes(vulnerability.name),
          vulnerability._meta.href,
          componentVulnerabilitiesBaseScore,
          vulnerability.severity
        )
      })
    }

    return vulnerabilityReport
  }

  private createUpgradeReport(
    recommendedVersion?: ComponentVersionUpgradeGuidanceTermView
  ): IUpgradeReport | undefined {
    if (recommendedVersion === undefined) {
      return undefined
    }

    return {
      name: recommendedVersion.versionName,
      href: recommendedVersion.version,
      vulnerabilityCount: Object.values(
        recommendedVersion.vulnerabilityRisk
      ).reduce((accumulatedValues, value) => accumulatedValues + value, 0)
    }
  }

  // noinspection SpellCheckingInspection
  private createVulnerabilityReport(
    name: string,
    violatesPolicy: boolean,
    href?: string,
    cvssScore?: number,
    severity?: string
  ): IVulnerabilityReport {
    // noinspection SpellCheckingInspection
    return { name, violatesPolicy, href, cvssScore, severity }
  }

  private createLicenseReport(
    name: string,
    href: string,
    violatesPolicy: boolean
  ): ILicenseReport {
    return { name, href, violatesPolicy }
  }
}
