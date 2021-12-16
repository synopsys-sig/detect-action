import { warning, info, debug } from '@actions/core'
import { create, UploadOptions } from '@actions/artifact'

export async function uploadRapidScanJson(outputPath: string, jsonFiles: string[]): Promise<void> {
  uploadArtifact('Rapid Scan JSON', outputPath, jsonFiles)
}

export async function uploadDiagnosticZip(outputPath: string, diagnosticZips: string[]): Promise<void> {
  uploadArtifact('Detect Diagnostic Zip', outputPath, diagnosticZips)
}

async function uploadArtifact(name: string, outputPath: string, files: string[]): Promise<void> {
  const artifactClient = create()
  const options: UploadOptions = {
    continueOnError: false,
    retentionDays: 0
  }

  info(`Attempting to upload ${name}...`)
  const uploadResponse = await artifactClient.uploadArtifact(name, files, outputPath, options)

  if (files.length === 0) {
    warning(`Expected to upload ${name}, but the action couldn't find any. Was output-path set correctly?`)
  } else if (uploadResponse.failedItems.length > 0) {
    warning(`An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`)
  } else {
    info(`Artifact ${uploadResponse.artifactName} has been successfully uploaded!`)
  }
}
