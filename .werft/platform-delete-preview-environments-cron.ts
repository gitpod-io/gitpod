import { Werft } from '../util/werft';
import * as Tracing from '../observability/tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { wipePreviewEnvironmentAndNamespace, helmInstallName, listAllPreviewNamespaces } from '../util/kubectl';
import { exec } from '../util/shell';
import { previewNameFromBranchName } from '../util/preview';

// Will be set once tracing has been initialized
let werft: Werft

Tracing.initialize()
    .then(() => {
        werft = new Werft("delete-preview-environment-cron")
    })
    .then(() => deletePreviewEnvironments())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err
        })
    })
    .finally(() => {
        werft.phase("Flushing telemetry", "Flushing telemetry before stopping job")
        werft.endAllSpans()
    })

async function deletePreviewEnvironments() {

    werft.phase("prep");
    try {
        const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`);
        exec('gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev');
    } catch (err) {
        werft.fail("prep", err)
    }
    werft.done("prep")

    werft.phase("Fetching branches");
    const branches = getAllBranches();
    // During the transition from the old preview names to the new ones we have to check for the existence of both the old or new
    // preview name patterns before it is safe to delete a namespace.
    const expectedPreviewEnvironmentNamespaces = new Set(branches.flatMap(branch => [parseBranch(branch), expectedNamespaceFromBranch(branch)]));
    werft.done("Fetching branches");

    werft.phase("Fetching previews");
    let previews: string[]
    try {
        previews = listAllPreviewNamespaces({});
        previews.forEach(previewNs => werft.log("Fetching previews", previewNs))
    } catch (err) {
        werft.fail("Fetching previews", err)
    }
    werft.done("Fetching previews");

    werft.phase("deleting previews")
    try {
        const previewsToDelete = previews.filter(ns => !expectedPreviewEnvironmentNamespaces.has(ns))
        // Trigger namespace deletion in parallel
        const promises = previewsToDelete.map(preview => wipePreviewEnvironmentAndNamespace(helmInstallName, preview, { slice: `Deleting preview ${preview}` }));
        // But wait for all of them to finish before (or one of them to fail) before we continue
        await Promise.all(promises)
    } catch (err) {
        werft.fail("deleting previews", err)
    }
    werft.done("deleting previews")
}

function getAllBranches(): string[] {
    return exec(`git branch -r | grep -v '\\->' | sed "s,\\x1B\\[[0-9;]*[a-zA-Z],,g" | while read remote; do echo "\${remote#origin/}"; done`).stdout.trim().split('\n');
}

function expectedNamespaceFromBranch(branch: string): string {
    const previewName = previewNameFromBranchName(branch)
    return `staging-${previewName}`
}

function parseBranch(branch: string): string {
    const prefix = 'staging-';
    const parsedBranch = branch.normalize().split("/").join("-");

    return prefix + parsedBranch;
}
