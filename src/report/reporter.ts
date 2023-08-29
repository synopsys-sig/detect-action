import { ReportResult } from '../model/report-result'

export interface Reporter {
  report(data: ReportResult): Promise<void>
}
