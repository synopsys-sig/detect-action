import * as core from '@actions/core'
import { create, UploadOptions } from '@actions/artifact'

export async function uploadArtifact(
  name: string,
  outputPath: string,
  files: string[]
): Promise<void> {
  const artifactClient = create()
  const options: UploadOptions = {
    continueOnError: false,
    retentionDays: 0
  }

  core.info(`Attempting to upload ${name}...`)
  const uploadResponse = await artifactClient.uploadArtifact(
    name,
    files,
    outputPath,
    options
  )

  if (files.length === 0) {
    core.warning(`Expected to upload ${name}, but no files were provided!`)
  } else if (uploadResponse.failedItems.length > 0) {
    core.warning(
      `An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`
    )
  } else {
    core.info(
      `Artifact ${uploadResponse.artifactName} has been successfully uploaded!`
    )
  }
}
