export interface ToolDownloader {
  download(): Promise<string>
}
