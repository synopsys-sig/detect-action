import {
  IComponentReport,
  ILicenseReport,
  IUpgradeReport,
  IVulnerabilityReport,
  ReportLine
} from '../model/report-line'
import { ReportResult } from '../model/report-result'
import { ReportGenerator } from './report-generator'
import { ReportProperties } from './report-properties'
import { TextBuilder } from './text-builder'
import { BlackDuckScanReportGenerator } from './blackduck-scan-report-generator'

const HEADER =
  '| Policies Violated | Dependency | License(s) | Vulnerabilities | Short Term Recommended Upgrade | Long Term Recommended Upgrade |'
const HEADER_ALIGNMENT = '|-|-|-|-|-|-|'

const SUCCESS_COMMENT =
  '# :white_check_mark: BlackDuck - None of your dependencies violate policy!'
const FAIL_COMMENT = (fail: boolean): string =>
  `# ${
    fail ? ':x:' : ':warning:'
  } BlackDuck - Found dependencies violating policy!`

export class BlackDuckReportGenerator
  implements ReportGenerator<ReportProperties, ReportResult>
{
  private readonly blackDuckScanReportGenerator: BlackDuckScanReportGenerator

  constructor(blackDuckScanReportGenerator: BlackDuckScanReportGenerator) {
    this.blackDuckScanReportGenerator = blackDuckScanReportGenerator
  }

  private makeReportLine(line: ReportLine): string {
    return `| ${line.policiesViolated} | ${line.dependency} | ${line.licenses} | ${line.vulnerabilities} | ${line.shortTermRecommendedUpgrade} | ${line.longTermRecommendedUpdate} |`
  }

  private addTitleToTextBuilder(
    textBuilder: TextBuilder,
    properties: ReportProperties
  ): void {
    textBuilder.addLines(FAIL_COMMENT(properties.failureConditionsMet))
  }

  private addHeaderToTextBuilder(textBuilder: TextBuilder): void {
    textBuilder.addLines(HEADER, HEADER_ALIGNMENT)
  }

  private async addContentToTextBuilder(
    textBuilder: TextBuilder,
    componentReports: IComponentReport[]
  ): Promise<boolean> {
    let isContentTruncated = false
    for (const componentReport of componentReports) {
      const line: ReportLine = {
        policiesViolated: this.getViolatedPolicies(
          componentReport.violatedPolicies
        ),
        dependency: this.getDependency(componentReport),
        licenses: this.getLicenses(componentReport.licenses),
        vulnerabilities: this.getVulnerabilities(
          componentReport.vulnerabilities
        ),
        shortTermRecommendedUpgrade: this.getTermUpgrade(
          componentReport.shortTermUpgrade
        ),
        longTermRecommendedUpdate: this.getTermUpgrade(
          componentReport.longTermUpgrade
        )
      }
      const theReportLine = this.makeReportLine(line)
      const addedLines = textBuilder.tryAddLines(theReportLine)
      if (!addedLines) {
        isContentTruncated = true
        break
      }
    }
    return isContentTruncated
  }

  private async generateSuccessReport(): Promise<ReportResult> {
    return {
      report: SUCCESS_COMMENT,
      failed: false,
      truncated: false,
      hasPolicyViolations: false
    }
  }

  private async generateFailureReport(
    componentReports: IComponentReport[],
    properties: ReportProperties
  ): Promise<ReportResult> {
    const textBuilder = new TextBuilder(properties.maxSize)

    this.addTitleToTextBuilder(textBuilder, properties)
    this.addHeaderToTextBuilder(textBuilder)
    const result = await this.addContentToTextBuilder(
      textBuilder,
      componentReports
    )

    return {
      report: textBuilder.build(),
      failed: properties.failureConditionsMet,
      truncated: result,
      hasPolicyViolations: true
    }
  }

  async generateReport(
    path: string,
    properties: ReportProperties
  ): Promise<ReportResult> {
    const blackDuckScanReport =
      await this.blackDuckScanReportGenerator.generateReport(path)
    return blackDuckScanReport.hasPolicyViolations
      ? this.generateFailureReport(blackDuckScanReport.reports, properties)
      : this.generateSuccessReport()
  }

  private getViolatedPolicies(violatedPolicies: string[]): string {
    return violatedPolicies.join('<br/>')
  }

  private getDependency(component: IComponentReport): string {
    return component?.href
      ? `[${component.name}](${component.href})`
      : component.name
  }

  private getLicenses(licenses: ILicenseReport[]): string {
    return licenses
      .map(license => {
        const name = license.href
          ? `[${license.name}](${license.href})`
          : license.name
        return `${license.violatesPolicy ? ':x: &nbsp; ' : ''}${name}`
      })
      .join('<br/>')
  }

  private getVulnerabilities(vulnerabilities: IVulnerabilityReport[]): string {
    // noinspection SpellCheckingInspection
    return vulnerabilities
      .map(
        vulnerability =>
          `${vulnerability.violatesPolicy ? ':x: &nbsp; ' : ''}[${
            vulnerability.name
          }](${vulnerability.href})${
            vulnerability.cvssScore && vulnerability.severity
              ? ` ${vulnerability.severity}: CVSS ${vulnerability.cvssScore}`
              : ''
          }`
      )
      .join('<br/>')
  }

  private getTermUpgrade(upgradeReport?: IUpgradeReport): string {
    return upgradeReport
      ? `[${upgradeReport.name}](${upgradeReport.href}) (${upgradeReport.vulnerabilityCount} known vulnerabilities)`
      : ''
  }
}
