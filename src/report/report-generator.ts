export interface ReportGenerator<P, T> {
  generateReport(path: string, properties: P): Promise<T>
}
