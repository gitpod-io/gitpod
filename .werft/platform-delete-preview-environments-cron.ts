import { Werft } from './util/werft';
import * as Tracing from './observability/tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { wipePreviewEnvironmentAndNamespace, helmInstallName, listAllPreviewNamespaces } from './util/kubectl';
import { exec } from './util/shell';
import { previewNameFromBranchName } from './util/preview';
import { CORE_DEV_KUBECONFIG_PATH, HARVESTER_KUBECONFIG_PATH } from './jobs/build/const';
import {deleteDNSRecord} from "./util/gcloud";
import * as VM from "./vm/vm";

// for testing purposes
// if set to 'true' it shows only previews that would be deleted
const DRY_RUN = false

const SLICES = {
    CONFIGURE_ACCESS: "Configuring access to relevant resources",
    INSTALL_HARVESTER_KUBECONFIG: "Install Harvester kubeconfig",
    FETCHING_PREVIEW_ENVIRONMENTS: "Fetching preview environments",
    FETCHING_BRANCHES: "Fetching branches",
    CHECKING_FOR_STALE_BRANCHES: "Checking for stale branches",
    CHECKING_FOR_NO_DB_ACTIVITY: "Checking for DB activity",
    DETERMINING_STALE_PREVIEW_ENVIRONMENTS: "Determining stale preview environments",
    DELETING_PREVIEW_ENVIRONMNETS: "Deleting preview environments"
}

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
        console.error("Werft job failed with an error", err)
        // Explicitly not using process.exit as we need to flush tracing, see tracing.js
        process.exitCode = 1
    })
    .finally(() => {
        werft.phase("Flushing telemetry", "Flushing telemetry before stopping job")
        werft.endAllSpans()
    })

class HarvesterPreviewEnvironment {

    // The prefix we use for the namespace
    static readonly namespacePrefix: string = "preview-"

    // The name of the namespace that the VM and related resources are in, e.g. preview-my-branch
    namespace: string

    // Then name of the preview environment, e.g. my-branch
    name: string

    constructor (namespace: string) {
        this.namespace = namespace
        this.name = namespace.replace(HarvesterPreviewEnvironment.namespacePrefix, "")
    }

    async delete(): Promise<void> {
        VM.deleteVM({ name: this.name })
    }

    async removeDNSRecords(sliceID: string) {
        werft.log(sliceID, "Deleting harvester related DNS records for the preview environment")
        await Promise.all([
            deleteDNSRecord('A', `*.ws-dev.${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `*.${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `prometheus-${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
            deleteDNSRecord('TXT', `prometheus-${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `grafana-${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
            deleteDNSRecord('TXT', `grafana-${this.name}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID)
        ])
    }

    isInactive(): boolean {
        // We'll port over the logic from CoreDevPreviewEnvironment later, for now we consider
        // Harvester preview environments to never be stale due to inactivity.
        const sliceID = SLICES.CHECKING_FOR_NO_DB_ACTIVITY
        werft.log(sliceID, `${this.name} (${this.namespace}) - is-inactive=false - Harvester based `)
        return false
    }

    /**
     * Given a branch name it will return the expected namespace of the preview environment
     */
    static expectedNamespaceFromBranch(branch: string): string {
        const previewName = previewNameFromBranchName(branch)
        return `${HarvesterPreviewEnvironment.namespacePrefix}${previewName}`
    }
}

class CoreDevPreviewEnvironment {

    // The prefix we use for the namespace
    static readonly namespacePrefix: string = "staging-"

    // The name of the namespace the VM and related resources are in, e.g. preview-my-branch
    namespace: string

    name: string

    constructor (namespace: string) {
        this.namespace = namespace
        this.name = namespace.replace(CoreDevPreviewEnvironment.namespacePrefix, "")
    }

    async delete(sliceID: string): Promise<void> {
        await wipePreviewEnvironmentAndNamespace(helmInstallName, this.namespace, CORE_DEV_KUBECONFIG_PATH, { slice: sliceID })
    }

    async removeDNSRecords(sliceID: string) {
        werft.log(sliceID, "Deleting core-dev related DNS records for the preview environment")
        await Promise.all([
            deleteDNSRecord('A', `*.ws-dev.${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `*.${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `prometheus-${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('TXT', `prometheus-${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('A', `grafana-${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('TXT', `grafana-${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('TXT', `_acme-challenge.${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
            deleteDNSRecord('TXT', `_acme-challenge.ws-dev.${this.name}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID)
        ])
    }

    /**
     * Checks whether or not a preview environment is considered inactive.
     *
     * It errors on the side of caution, so in case of connection issues etc. it will consider the
     * preview environment active.
     */
    isInactive(): boolean {
        const sliceID = SLICES.CHECKING_FOR_NO_DB_ACTIVITY
        try {
            const statusNS = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get ns ${this.namespace} -o jsonpath='{.status.phase}'`, { slice: sliceID })

            if (statusNS != "Active") {
                werft.log(sliceID, `${this.name} (${this.namespace}) - is-inactive=false - The namespace is ${statusNS}`)
                return false
            }

            werft.log(sliceID, `${this.name} (${this.namespace}) - Checking status of the MySQL pod`)
            const statusDB = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods mysql-0 -n ${this.namespace} -o jsonpath='{.status.phase}'`, { slice: sliceID})
            const statusDbContainer = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods mysql-0 -n ${this.namespace} -o jsonpath='{.status.containerStatuses.*.ready}'`, { slice: sliceID})

            if (statusDB.code != 0 || statusDB != "Running" || statusDbContainer == "false") {
                werft.log(sliceID, `${this.name} (${this.namespace}) - is-inactive=false - The database is not reachable`)
                return false
            }

            const dbPassword = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get secret db-password -n ${this.namespace} -o jsonpath='{.data.mysql-root-password}' | base64 -d`, {silent: true}).stdout.trim()
            const connectionToDb = `mysql --host=db.${this.namespace}.svc.cluster.local --port=3306 --user=root --database=gitpod -s -N --password=${dbPassword}`

            const latestInstanceTimeout = 48
            const latestInstance = exec(`${connectionToDb} --execute="SELECT creationTime FROM d_b_workspace_instance WHERE creationTime > DATE_SUB(NOW(), INTERVAL '${latestInstanceTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

            const latestUserTimeout = 48
            const latestUser= exec(`${connectionToDb} --execute="SELECT creationDate FROM d_b_user WHERE creationDate > DATE_SUB(NOW(), INTERVAL '${latestUserTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

            const lastModifiedTimeout = 48
            const lastModified= exec(`${connectionToDb} --execute="SELECT _lastModified FROM d_b_user WHERE _lastModified > DATE_SUB(NOW(), INTERVAL '${lastModifiedTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

            const heartbeatTimeout = 48
            const heartbeat= exec(`${connectionToDb} --execute="SELECT lastSeen FROM d_b_workspace_instance_user WHERE lastSeen > DATE_SUB(NOW(), INTERVAL '${heartbeatTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

            const isInactive = (heartbeat.length < 1) && (latestInstance.length < 1) && (latestUser.length < 1) && (lastModified.length < 1)
            werft.log(sliceID, `${this.name} (${this.namespace}) - is-inactive=${isInactive}`)
            return isInactive
        } catch (err) {
            werft.log(sliceID, `${this.name} (${this.namespace}) - is-inactive=false - Unable to check DB activity`)
            return false
        }
    }


    /**
     * Given a branch name it will return the expected namespace of the preview environment
     */
    static expectedNamespaceFromBranch(branch: string): string {
        const previewName = previewNameFromBranchName(branch)
        return `${CoreDevPreviewEnvironment.namespacePrefix}${previewName}`
    }

}

type PreviewEnvironment = CoreDevPreviewEnvironment | HarvesterPreviewEnvironment

async function getAllPreviewEnvironments(slice: string): Promise<PreviewEnvironment[]> {
    const coreDevPreviewEnvironments = listAllPreviewNamespaces(CORE_DEV_KUBECONFIG_PATH, {slice: slice})
        .map((namespace: string) => new CoreDevPreviewEnvironment(namespace))

    const harvesterPreviewEnvironments = exec(`kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} get ns -o=custom-columns=:metadata.name | grep preview-`, { slice, silent: true, async: false })
        .stdout
        .trim()
        .split("\n")
        .map(namespace => new HarvesterPreviewEnvironment(namespace.trim()))

    const all = coreDevPreviewEnvironments.concat(harvesterPreviewEnvironments)

    werft.currentPhaseSpan.setAttributes({
        "preview_environments.counts.core_dev": coreDevPreviewEnvironments.length,
        "preview_environments.counts.harvester": harvesterPreviewEnvironments.length,
    })

    // We never want to delete the environment for the main branch.
    return all.filter((preview: PreviewEnvironment) => preview.name != "main")
}

async function deletePreviewEnvironments() {

    werft.phase("Configure access");
    try {
        const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, {slice: SLICES.CONFIGURE_ACCESS});
        exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev`, {slice: SLICES.CONFIGURE_ACCESS});
        werft.done(SLICES.CONFIGURE_ACCESS)
    } catch (err) {
        werft.fail(SLICES.CONFIGURE_ACCESS, err)
    }

    werft.phase("Install Harvester kubeconfig");
    try {
        exec(`cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`, { slice: SLICES.INSTALL_HARVESTER_KUBECONFIG })
        werft.done(SLICES.INSTALL_HARVESTER_KUBECONFIG)
    } catch (err) {
        werft.fail(SLICES.INSTALL_HARVESTER_KUBECONFIG, err)
    }

    werft.phase("Fetching preview environments");
    let previews: PreviewEnvironment[]
    try {
        previews = await getAllPreviewEnvironments(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
        previews.forEach((preview: PreviewEnvironment) => werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `${preview.name} (${preview.namespace})`));
        werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `Found ${previews.length} preview environments`)
        werft.done(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
    } catch (err) {
        werft.fail(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, err)
    }

    werft.phase("Fetching branches");
    const branches = getAllBranches();
    werft.log(SLICES.FETCHING_BRANCHES, `Found ${branches.length} branches`)

    werft.phase("Determining which preview environments are stale");

    const previewsToDelete = await determineStalePreviewEnvironments({
        branches: branches,
        previews: previews
    })

    if (previewsToDelete.length == 0) {
        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, "No stale preview environments.")
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS)
        return
    } else {
        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, `Found ${previewsToDelete.length} stale preview environments`)
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS)
    }

    werft.phase("Deleting stale preview environments")
    if (DRY_RUN) {
        previewsToDelete.forEach(preview => {
            werft.log(SLICES.DELETING_PREVIEW_ENVIRONMNETS, `Would have deleted preview environment ${preview.name} (${preview.namespace})`)
        })
        werft.done(SLICES.DELETING_PREVIEW_ENVIRONMNETS)
        return
    }

    try {
        const promises: Promise<any>[] = [];
        previewsToDelete.forEach(preview => promises.push(removePreviewEnvironment(preview)))
        await Promise.all(promises)
        werft.done(SLICES.DELETING_PREVIEW_ENVIRONMNETS)
    } catch (err) {
        werft.fail(SLICES.DELETING_PREVIEW_ENVIRONMNETS, err)
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
async function determineStalePreviewEnvironments(options: {previews: PreviewEnvironment[], branches: string[]}): Promise<PreviewEnvironment[]> {

    const {branches, previews} = options

    // The set of namespaces that we would expect based on the open branches.
    // This contains both the core-dev and the harvester namespaces as we only use this set for
    // testing membership in situations where we don't care if the preview environment is based on
    // core-dev or harvester.
    const previewNamespaceBasedOnBranches = new Set(branches.flatMap(branch => [
        CoreDevPreviewEnvironment.expectedNamespaceFromBranch(branch),
        HarvesterPreviewEnvironment.expectedNamespaceFromBranch(branch)
    ]));

    // The set of namespaces where the underlying branch is considered stale
    // This contains both core-dev and harvester namespaces, see above.
    werft.log(SLICES.CHECKING_FOR_STALE_BRANCHES, `Checking commit activity on ${branches.length} branches`)
    const previewNamespaceBasedOnStaleBranches = new Set(branches
        .filter(branch => {
            const lastCommit = exec(`git log origin/${branch} --since=$(date +%Y-%m-%d -d "2 days ago")`, { silent: true })
            const hasRecentCommits = lastCommit.length > 1
            werft.log(SLICES.CHECKING_FOR_STALE_BRANCHES, `${branch} has-recent-commits=${hasRecentCommits}`)
            return !hasRecentCommits
        })
        .flatMap((branch: string) => [
            CoreDevPreviewEnvironment.expectedNamespaceFromBranch(branch),
            HarvesterPreviewEnvironment.expectedNamespaceFromBranch(branch)
        ]))
    werft.done(SLICES.CHECKING_FOR_STALE_BRANCHES)

    werft.log(SLICES.CHECKING_FOR_NO_DB_ACTIVITY, `Checking ${previews.length} preview environments for DB activity`)
    const previewNamespacesWithNoDBActivity = new Set(
        previews
            .filter((preview) => preview.isInactive())
            .map((preview) => preview.namespace)
    )

    werft.done(SLICES.CHECKING_FOR_NO_DB_ACTIVITY)

    const previewsToDelete = previews.filter((preview: PreviewEnvironment) => {
        if (!previewNamespaceBasedOnBranches.has(preview.namespace)) {
            werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, `Considering ${preview.name} (${preview.namespace}) stale due to missing branch`)
            return true
        }

        if (previewNamespaceBasedOnStaleBranches.has(preview.namespace)) {
            werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, `Considering ${preview.name} (${preview.namespace}) stale due to no recent commit activity`)
            return true
        }

        if (previewNamespacesWithNoDBActivity.has(preview.namespace)) {
            werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, `Considering ${preview.name} (${preview.namespace}) stale due to no recent DB activity`)
            return true
        }

        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, `Considering ${preview.name} (${preview.namespace}) active`)
        return false
    })

    return previewsToDelete
}

async function removePreviewEnvironment(previewEnvironment: PreviewEnvironment) {
    const sliceID = `Deleting preview ${previewEnvironment.name}`
    werft.log(sliceID, `Starting deletion of all resources related to ${previewEnvironment.name}`)
    try {
        // We're running these promises sequentially to make it easier to read the log output.
        await removeCertificate(previewEnvironment.name, CORE_DEV_KUBECONFIG_PATH, sliceID)
        await previewEnvironment.removeDNSRecords(sliceID)
        await previewEnvironment.delete(sliceID)
        werft.done(sliceID)
    } catch (e) {
        werft.failSlice(sliceID, e)
    }
}

async function removeCertificate(preview: string, kubectlConfig: string, slice: string) {
    return exec(`kubectl --kubeconfig ${kubectlConfig} -n certs delete --ignore-not-found=true cert ${preview}`, {slice: slice, async: true})
}

async function cleanLoadbalancer() {
    const fetchPhase = "fetching unuse loadbalancer"
    const deletionPhase = "deleting unused load balancers"

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
