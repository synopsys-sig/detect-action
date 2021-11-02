import * as core from "@actions/core";
import { create, UploadOptions } from "@actions/artifact";

export async function run(
  output_path: string,
  json_files: string[]
): Promise<void> {
  const artifactClient = create();
  const options: UploadOptions = {
    continueOnError: false,
    retentionDays: 0,
  };

  const uploadResponse = await artifactClient.uploadArtifact(
    "Rapid Scan JSON",
    json_files,
    output_path,
    options
  );

  if (uploadResponse.failedItems.length > 0) {
    core.setFailed(
      `An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`
    );
  } else {
    core.info(
      `Artifact ${uploadResponse.artifactName} has been successfully uploaded!`
    );
  }
}
