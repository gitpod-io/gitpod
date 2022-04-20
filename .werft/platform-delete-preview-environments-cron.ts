import { Werft } from './util/werft';
import * as Tracing from './observability/tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { wipePreviewEnvironmentAndNamespace, helmInstallName, listAllPreviewNamespaces } from './util/kubectl';
import { exec } from './util/shell';
import { previewNameFromBranchName } from './util/preview';
import { CORE_DEV_KUBECONFIG_PATH, HARVESTER_KUBECONFIG_PATH } from './jobs/build/const';

// Will be set once tracing has been initialized
let werft: Werft

Tracing.initialize()
    .then(() => {
        werft = new Werft("delete-preview-environment-cron")
    })
    .then(() => deletePreviewEnvironments())
    .then(() => cleanLoadbalancer())
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
        exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev`);
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
        previews = listAllPreviewNamespaces(CORE_DEV_KUBECONFIG_PATH, {});
        previews.forEach(previewNs => werft.log("Fetching previews", previewNs))
    } catch (err) {
        werft.fail("Fetching previews", err)
    }
    werft.done("Fetching previews");

    werft.phase("deleting previews")
    try {
        const previewsToDelete = previews.filter(ns => !expectedPreviewEnvironmentNamespaces.has(ns))
        // Trigger namespace deletion in parallel
        const promises = previewsToDelete.map(preview => wipePreviewEnvironmentAndNamespace(helmInstallName, preview, CORE_DEV_KUBECONFIG_PATH, { slice: `Deleting preview ${preview}` }));
        // But wait for all of them to finish before (or one of them to fail) before we continue
        await Promise.all(promises)
    } catch (err) {
        werft.fail("deleting previews", err)
    }
    werft.done("deleting previews")
}

async function cleanLoadbalancer() {
    const prepPhase = "prep clean loadbalancers"
    const fetchPhase = "fetching unuse loadbalancer"
    const deletionPhase = "deleting unused load balancers"

    werft.phase(prepPhase);
    try {
        exec(`cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`)
    } catch (err) {
        werft.fail(prepPhase, err)
    }
    werft.done(prepPhase)


    werft.phase(fetchPhase);
    let lbsToDelete: string[]
    try {
        // get all loadbalancer
        let lbs: string[] = exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get deployment -n loadbalancers -o=jsonpath="{.items[*].metadata.labels['gitpod\\.io\\/lbName']}"`, { silent: true }).stdout.trim().split(' ');
        let previews = exec(`kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} get namespaces -o go-template --template '{{range .items}}{{.metadata.name}}{{"\\n"}}{{end}}' | awk '/(preview-.*)/ { print $1 }'`, { silent: true }).stdout.trim().split('\n')
        let previewSet = new Set(previews)
        lbsToDelete = lbs.filter(lb => !previewSet.has('preview-' + lb))
        lbsToDelete.forEach(lb => werft.log(fetchPhase, "will delete " + lb))
    } catch (err) {
        werft.fail(fetchPhase, err);
    }


    werft.phase(deletionPhase);
    try {
        lbsToDelete.forEach(lb => {
            werft.log(deletionPhase, "deleteing " + lb);
            exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers delete deployment lb-${lb}`)
            exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers delete service lb-${lb}`)
        });
    } catch (err) {
        werft.fail(deletionPhase, err)
    }
    werft.done(deletionPhase)
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
