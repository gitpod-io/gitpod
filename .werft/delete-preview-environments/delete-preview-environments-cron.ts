import { Werft } from "../util/werft";
import * as Tracing from "../observability/tracing";
import { SpanStatusCode } from "@opentelemetry/api";
import {
  wipePreviewEnvironmentAndNamespace,
  helmInstallName,
  listAllPreviewNamespaces,
} from "../util/kubectl";
import { exec } from "../util/shell";

// Will be set once tracing has been initialized
let werft: Werft;

Tracing.initialize()
  .then(() => {
    werft = new Werft("delete-preview-environment-cron");
  })
  .then(() => deletePreviewEnvironments())
  .then(() => werft.endAllSpans())
  .catch((err) => {
    werft.rootSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: err,
    });
    werft.endAllSpans();
  });

async function deletePreviewEnvironments() {
  werft.phase("prep");
  try {
    const GCLOUD_SERVICE_ACCOUNT_PATH =
      "/mnt/secrets/gcp-sa/service-account.json";
    exec(
      `gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`
    );
    exec(
      "gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev"
    );
  } catch (err) {
    werft.fail("prep", err);
  }
  werft.done("prep");

  werft.phase("Fetching branches");
  const branches = getAllBranches();
  const expectedPreviewEnvironmentNamespaces = new Set(
    branches.map((branch) => parseBranch(branch))
  );
  werft.done("Fetching branches");

  werft.phase("Fetching previews");
  let previews;
  try {
    previews = listAllPreviewNamespaces({});
  } catch (err) {
    werft.fail("Fetching previews", err);
  }
  werft.done("Fetching previews");

  werft.phase("Mapping previews => branches");
  const previewsToDelete = previews.filter(
    (ns) => !expectedPreviewEnvironmentNamespaces.has(ns)
  );

  werft.phase("deleting previews");
  try {
    previewsToDelete.forEach((preview) =>
      wipePreviewEnvironmentAndNamespace(helmInstallName, preview, {
        slice: `Deleting preview ${preview}`,
      })
    );
  } catch (err) {
    werft.fail("deleting previews", err);
  }
  werft.done("deleting previews");
}

function getAllBranches(): string[] {
  return exec(
    `git branch -r | grep -v '\\->' | sed "s,\\x1B\\[[0-9;]*[a-zA-Z],,g" | while read remote; do echo "\${remote#origin/}"; done`
  )
    .stdout.trim()
    .split("\n");
}

function parseBranch(branch: string): string {
  const prefix = "staging-";
  const parsedBranch = branch.normalize().split("/").join("-");

  return prefix + parsedBranch;
}
