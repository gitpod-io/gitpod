import { Werft } from "./util/werft";
import * as Tracing from "./observability/tracing";
import { SpanStatusCode } from "@opentelemetry/api";
import { exec } from "./util/shell";
import { CORE_DEV_KUBECONFIG_PATH, HARVESTER_KUBECONFIG_PATH } from "./jobs/build/const";
import { HarvesterPreviewEnvironment, PreviewEnvironment } from "./util/preview";

// for testing purposes
// if set to 'true' it shows only previews that would be deleted
const DRY_RUN = false;

const SLICES = {
    CONFIGURE_ACCESS: "Configuring access to relevant resources",
    INSTALL_HARVESTER_KUBECONFIG: "Install Harvester kubeconfig",
    FETCHING_PREVIEW_ENVIRONMENTS: "Fetching preview environments",
    FETCHING_BRANCHES: "Fetching branches",
    CHECKING_FOR_STALE_BRANCHES: "Checking for stale branches",
    CHECKING_FOR_DB_ACTIVITY: "Checking for DB activity",
    DETERMINING_STALE_PREVIEW_ENVIRONMENTS: "Determining stale preview environments",
    DELETING_PREVIEW_ENVIRONMNETS: "Deleting preview environments",
    DELETING_ORPHAN_CERTIFICATES: "Deleting certificates without a matching preview environment",
};

// Will be set once tracing has been initialized
let werft: Werft;

Tracing.initialize()
    .then(() => {
        werft = new Werft("delete-preview-environment-cron");
    })
    .then(() => deletePreviewEnvironments())
    .then(() => cleanLoadbalancer())
    .then(() => removeOrphanCertificates())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err,
        });
        console.error("Werft job failed with an error", err);
        // Explicitly not using process.exit as we need to flush tracing, see tracing.js
        process.exitCode = 1;
    })
    .finally(() => {
        werft.phase("Flushing telemetry", "Flushing telemetry before stopping job");
        werft.endAllSpans();
    });

async function getAllPreviewEnvironments(slice: string): Promise<PreviewEnvironment[]> {
    const harvesterPreviewEnvironments = exec(
        `kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} get ns -o=custom-columns=:metadata.name | grep preview-`,
        { slice, silent: true, async: false },
    )
        .stdout.trim()
        .split("\n")
        .map((namespace) => new HarvesterPreviewEnvironment(werft, namespace.trim()));

    werft.currentPhaseSpan.setAttributes({
        "preview_environments.counts.harvester": harvesterPreviewEnvironments.length,
    });

    // We never want to delete the environment for the main branch.
    return harvesterPreviewEnvironments.filter((preview: PreviewEnvironment) => preview.name != "main");
}

async function deletePreviewEnvironments() {
    werft.phase("Configure access");
    try {
        const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, {
            slice: SLICES.CONFIGURE_ACCESS,
        });
        exec(
            `KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev`,
            { slice: SLICES.CONFIGURE_ACCESS },
        );
        werft.done(SLICES.CONFIGURE_ACCESS);
    } catch (err) {
        werft.fail(SLICES.CONFIGURE_ACCESS, err);
    }

    werft.phase("Install Harvester kubeconfig");
    try {
        exec(`cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`, {
            slice: SLICES.INSTALL_HARVESTER_KUBECONFIG,
        });
        werft.done(SLICES.INSTALL_HARVESTER_KUBECONFIG);
    } catch (err) {
        werft.fail(SLICES.INSTALL_HARVESTER_KUBECONFIG, err);
    }

    werft.phase("Fetching preview environments");
    let previews: PreviewEnvironment[];
    try {
        previews = await getAllPreviewEnvironments(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
        previews.forEach((preview: PreviewEnvironment) =>
            werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `${preview.name} (${preview.namespace})`),
        );
        werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `Found ${previews.length} preview environments`);
        werft.done(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
    } catch (err) {
        werft.fail(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, err);
    }

    werft.phase("Fetching branches");
    const branches = getAllBranches();
    werft.log(SLICES.FETCHING_BRANCHES, `Found ${branches.length} branches`);

    werft.phase("Determining which preview environments are stale");

    const previewsToDelete = await determineStalePreviewEnvironments({
        branches: branches,
        previews: previews,
    });

    if (previewsToDelete.length == 0) {
        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, "No stale preview environments.");
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS);
        return;
    } else {
        werft.log(
            SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS,
            `Found ${previewsToDelete.length} stale preview environments`,
        );
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS);
    }

    werft.phase("Deleting stale preview environments");
    if (DRY_RUN) {
        previewsToDelete.forEach((preview) => {
            werft.log(
                SLICES.DELETING_PREVIEW_ENVIRONMNETS,
                `Would have deleted preview environment ${preview.name} (${preview.namespace})`,
            );
        });
        werft.done(SLICES.DELETING_PREVIEW_ENVIRONMNETS);
        return;
    }

    try {
        const promises: Promise<any>[] = [];
        previewsToDelete.forEach((preview) => promises.push(removePreviewEnvironment(preview)));
        await Promise.all(promises);
        werft.done(SLICES.DELETING_PREVIEW_ENVIRONMNETS);
    } catch (err) {
        werft.fail(SLICES.DELETING_PREVIEW_ENVIRONMNETS, err);
    }
}

/**
 * Determines if preview environemnts are stale and should be deleted
 *
 * As we don't have a mapping from preview environnment -> Git branch we have to
 * go about this in a bit of a backwards way.
 *
 * Based on the active git branches we compute a set of "expected" preview environments
 * and then use that to compare with the "live" preview environemnts to decide which
 * ones to keep
 */
async function determineStalePreviewEnvironments(options: {
    previews: PreviewEnvironment[];
    branches: string[];
}): Promise<PreviewEnvironment[]> {
    const { branches, previews } = options;

    // The set of namespaces that we would expect based on the open branches.
    // This contains both the core-dev and the harvester namespaces as we only use this set for
    // testing membership in situations where we don't care if the preview environment is based on
    // core-dev or harvester.
    const previewNamespaceBasedOnBranches = new Set(
        branches.flatMap((branch) => [HarvesterPreviewEnvironment.expectedNamespaceFromBranch(branch)]),
    );

    // The set of namespaces where the underlying branch is considered stale
    // This contains both core-dev and harvester namespaces, see above.
    werft.log(SLICES.CHECKING_FOR_STALE_BRANCHES, `Checking commit activity on ${branches.length} branches`);
    const previewNamespaceBasedOnStaleBranches = new Set(
        branches
            .filter((branch) => {
                const lastCommit = exec(`git log origin/${branch} --since=$(date +%Y-%m-%d -d "2 days ago")`, {
                    silent: true,
                });
                const hasRecentCommits = lastCommit.length > 1;
                werft.log(SLICES.CHECKING_FOR_STALE_BRANCHES, `${branch} has-recent-commits=${hasRecentCommits}`);
                return !hasRecentCommits;
            })
            .flatMap((branch: string) => [HarvesterPreviewEnvironment.expectedNamespaceFromBranch(branch)]),
    );
    werft.done(SLICES.CHECKING_FOR_STALE_BRANCHES);

    werft.log(SLICES.CHECKING_FOR_DB_ACTIVITY, `Checking ${previews.length} preview environments for DB activity`);
    const previewNamespacesWithNoDBActivity = new Set(
        previews
            .filter((preview) => !preview.isActive(SLICES.CHECKING_FOR_DB_ACTIVITY))
            .map((preview) => preview.namespace),
    );

    werft.done(SLICES.CHECKING_FOR_DB_ACTIVITY);

    const previewsToDelete = previews.filter((preview: PreviewEnvironment) => {
        if (!previewNamespaceBasedOnBranches.has(preview.namespace)) {
            werft.log(
                SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS,
                `Considering ${preview.name} (${preview.namespace}) stale due to missing branch`,
            );
            return true;
        }

        if (
            previewNamespaceBasedOnStaleBranches.has(preview.namespace) &&
            previewNamespacesWithNoDBActivity.has(preview.namespace)
        ) {
            werft.log(
                SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS,
                `Considering ${preview.name} (${preview.namespace}) stale due to no recent commit and DB activity`,
            );
            return true;
        }

        werft.log(
            SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS,
            `Considering ${preview.name} (${preview.namespace}) active`,
        );
        return false;
    });

    return previewsToDelete;
}

async function removePreviewEnvironment(previewEnvironment: PreviewEnvironment) {
    const sliceID = `Deleting preview ${previewEnvironment.name}`;
    werft.log(sliceID, `Starting deletion of all resources related to ${previewEnvironment.name}`);
    try {
        // We're running these promises sequentially to make it easier to read the log output.
        await previewEnvironment.removeDNSRecords(sliceID);
        await previewEnvironment.delete();
        werft.done(sliceID);
    } catch (e) {
        werft.failSlice(sliceID, e);
    }
}

async function removeOrphanCertificates() {
    const certificatesNamespace = "certs";
    werft.phase(SLICES.DELETING_ORPHAN_CERTIFICATES);

    const certificates = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get certificates -n ${certificatesNamespace} -o=custom-columns=:metadata.name | grep harvester-`,
        { slice: SLICES.DELETING_ORPHAN_CERTIFICATES, silent: true, async: false },
    )
        .stdout.trim()
        .split("\n");

    const previews = exec(
        `kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} get ns -o=custom-columns=:metadata.name | grep preview-`,
        { slice: SLICES.DELETING_ORPHAN_CERTIFICATES, silent: true, async: false },
    )
        .stdout.trim()
        .replace(/preview-/g, "")
        .split("\n");

    certificates.forEach((certificate) => {
        const owner = exec(
            `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get certificates ${certificate} -n ${certificatesNamespace} -o=custom-columns=:metadata.annotations.preview/owner`,
            { slice: SLICES.DELETING_ORPHAN_CERTIFICATES, silent: true, async: false },
        ).stdout.trim();

        if (DRY_RUN) {
            if (!previews.includes(owner)) {
                werft.log(SLICES.DELETING_ORPHAN_CERTIFICATES, `Certificate ${certificate} would have been deleted`);
            } else {
                werft.log(
                    SLICES.DELETING_ORPHAN_CERTIFICATES,
                    `Certificate ${certificate} would NOT have been deleted`,
                );
            }
        }

        if (!previews.includes(owner) && !DRY_RUN) {
            exec(
                `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n ${certificatesNamespace} delete --ignore-not-found=true cert ${certificate}`,
                { slice: SLICES.DELETING_ORPHAN_CERTIFICATES, async: true, silent: true },
            );
        }
    });

    werft.done(SLICES.DELETING_ORPHAN_CERTIFICATES);
}

async function cleanLoadbalancer() {
    const fetchPhase = "fetching unuse loadbalancer";
    const deletionPhase = "deleting unused load balancers";

    werft.phase(fetchPhase);
    let lbsToDelete: string[];
    try {
        // get all loadbalancer
        let lbs: string[] = exec(
            `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get deployment -n loadbalancers -o=jsonpath="{.items[*].metadata.labels['gitpod\\.io\\/lbName']}"`,
            { silent: true },
        )
            .stdout.trim()
            .split(" ");
        let previews = exec(
            `kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} get namespaces -o go-template --template '{{range .items}}{{.metadata.name}}{{"\\n"}}{{end}}' | awk '/(preview-.*)/ { print $1 }'`,
            { silent: true },
        )
            .stdout.trim()
            .split("\n");
        let previewSet = new Set(previews);
        lbsToDelete = lbs.filter((lb) => !previewSet.has("preview-" + lb));
        lbsToDelete.forEach((lb) => werft.log(fetchPhase, "will delete " + lb));
    } catch (err) {
        werft.fail(fetchPhase, err);
    }

    werft.phase(deletionPhase);
    try {
        lbsToDelete.forEach((lb) => {
            werft.log(deletionPhase, "deleteing " + lb);
            exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers delete deployment lb-${lb}`);
            exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers delete service lb-${lb}`);
        });
    } catch (err) {
        werft.fail(deletionPhase, err);
    }
    werft.done(deletionPhase);
}

function getAllBranches(): string[] {
    return exec(
        `git branch -r | grep -v '\\->' | sed "s,\\x1B\\[[0-9;]*[a-zA-Z],,g" | while read remote; do echo "\${remote#origin/}"; done`,
    )
        .stdout.trim()
        .split("\n");
}
