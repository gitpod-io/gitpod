import { Werft } from './util/werft';
import * as Tracing from './observability/tracing';
import { SpanStatusCode } from '@opentelemetry/api';
import { wipePreviewEnvironmentAndNamespace, helmInstallName, listAllPreviewNamespaces } from './util/kubectl';
import { exec } from './util/shell';
import { previewNameFromBranchName } from './util/preview';
import { CORE_DEV_KUBECONFIG_PATH, HARVESTER_KUBECONFIG_PATH } from './jobs/build/const';
import {deleteDNSRecord} from "./util/gcloud";

// for testing purposes
// if set to 'true' it shows only previews that would be deleted
const DRY_RUN = false

const SLICES = {
    CONFIGURE_ACCESS: "Configuring access to relevant resources",
    FETCHING_PREVIEW_ENVIRONMENTS: "Fetching preview environments",
    FETCHING_BRANCHES: "Fetching branches",
    DETERMINING_STALE_PREVIEW_ENVIRONMENTS: "Determining stale preview environments",
    CHECKING_STALE_BRANCH: (branch: string) => `Checking for commit activity on ${branch}`,
    CHECKING_DB_ACTIVITY: (preview: string) => `Checking for DB activity in ${preview}`,
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

    werft.phase("Fetching preview environments");
    let previews: string[]
    try {
        previews = listAllPreviewNamespaces(CORE_DEV_KUBECONFIG_PATH, {});
        previews.forEach(previewNs => werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, previewNs));
        werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `Found ${previews.length} preview environments`)
        werft.done(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
    } catch (err) {
        werft.fail(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, err)
    }

    werft.phase("Fetching branches");
    const branches = getAllBranches();
    werft.log(SLICES.FETCHING_BRANCHES, `Found ${branches.length} branches`)

    werft.phase("Determining which preview environments are stale");

    const previewNamespaceBasedOnBranches = new Set(branches.map(branch => expectedNamespaceFromBranch(branch)));

    const previewNamespaceBasedOnStaleBranches = new Set(branches
        .filter(branch => {
            const sliceID = SLICES.CHECKING_STALE_BRANCH(branch)
            const lastCommit = exec(`git log origin/${branch} --since=$(date +%Y-%m-%d -d "5 days ago")`, { slice: sliceID })
            const hasRecentCommits = lastCommit.length > 1
            werft.log(sliceID, `Has recent commits: ${hasRecentCommits}`)
            werft.done(sliceID)
            return !hasRecentCommits
        })
        .map(branch => expectedNamespaceFromBranch(branch)))

    const deleteDueToMissingBranch     = previews.filter(ns => !previewNamespaceBasedOnBranches.has(ns))
    const deleteDueToNoCommitActivity  = previews.filter(ns => previewNamespaceBasedOnStaleBranches.has(ns))
    const deleteDueToNoDBActivity      = previews.filter(ns => isInactive(ns))
    const previewsToDelete             = new Set([...deleteDueToMissingBranch, ...deleteDueToNoCommitActivity, ...deleteDueToNoDBActivity])

    if (previewsToDelete.has("staging-main")) {
        previewsToDelete.delete("staging-main")
    }

    if (previewsToDelete.size == 0) {
        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, "No stale preview environments.")
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS)
        return
    } else {
        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, `Found ${previewsToDelete.size} stale preview environments`)
    }

    werft.phase("Deleting stale preview environments")
    if (DRY_RUN) {
        previewsToDelete.forEach(preview => {
            werft.log(SLICES.DELETING_PREVIEW_ENVIRONMNETS, `Would have deleted preview environment ${preview}`)
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

async function removePreviewEnvironment(previewNamespace: string) {
    const sliceID = `Deleting preview ${previewNamespace}`
    werft.log(sliceID, `Starting deletion of all resources related to ${previewNamespace}`)
    try {
        const previewDNSName = previewNamespace.replace('staging-', '')

        // We're running these promises sequentially to make it easier to read the log output.
        await removeCertificate(previewNamespace, CORE_DEV_KUBECONFIG_PATH, sliceID)
        await removeStagingDNSRecord(previewDNSName, sliceID)
        await removePreviewDNSRecord(previewDNSName, sliceID)
        await wipePreviewEnvironmentAndNamespace(helmInstallName, previewNamespace, CORE_DEV_KUBECONFIG_PATH, { slice: sliceID })
        werft.done(sliceID)
    } catch (e) {
        werft.fail(sliceID, e)
    }
}

/**
 * Checks whether or not a preview environment is considered inactive.
 *
 * It errors on the side of caution, so in case of connection issues etc. it will consider the
 * preview environment active.
 */
function isInactive(previewNS: string): boolean {
    const sliceID = SLICES.CHECKING_DB_ACTIVITY(previewNS)
    try {
        werft.log(sliceID, "Checking namespace status")
        const statusNS = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get ns ${previewNS} -o jsonpath='{.status.phase}'`, { slice: sliceID })

        if (statusNS != "Active") {
            werft.log(sliceID, `Is inactive: false - The namespace is ${statusNS}`)
            werft.done(sliceID)
            return false
        }

        werft.log(sliceID, "Checking status of the MySQL pod")
        const statusDB = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods mysql-0 -n ${previewNS} -o jsonpath='{.status.phase}'`, { slice: sliceID})
        const statusDbContainer = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods mysql-0 -n ${previewNS} -o jsonpath='{.status.containerStatuses.*.ready}'`, { slice: sliceID})

        if (statusDB.code != 0 || statusDB != "Running" || statusDbContainer == "false") {
            werft.log(sliceID, "Is inactive: false - The database is not reachable")
            werft.done(sliceID)
            return false
        }

        const dbPassword = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get secret db-password -n ${previewNS} -o jsonpath='{.data.mysql-root-password}' | base64 -d`, {silent: true}).stdout.trim()
        const connectionToDb = `mysql --host=db.${previewNS}.svc.cluster.local --port=3306 --user=root --database=gitpod -s -N --password=${dbPassword}`

        const latestInstanceTimeout = 48
        const latestInstance = exec(`${connectionToDb} --execute="SELECT creationTime FROM d_b_workspace_instance WHERE creationTime > DATE_SUB(NOW(), INTERVAL '${latestInstanceTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

        const latestUserTimeout = 48
        const latestUser= exec(`${connectionToDb} --execute="SELECT creationDate FROM d_b_user WHERE creationDate > DATE_SUB(NOW(), INTERVAL '${latestUserTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

        const lastModifiedTimeout = 48
        const lastModified= exec(`${connectionToDb} --execute="SELECT _lastModified FROM d_b_user WHERE _lastModified > DATE_SUB(NOW(), INTERVAL '${lastModifiedTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

        const heartbeatTimeout = 48
        const heartbeat= exec(`${connectionToDb} --execute="SELECT lastSeen FROM d_b_workspace_instance_user WHERE lastSeen > DATE_SUB(NOW(), INTERVAL '${heartbeatTimeout}' HOUR) LIMIT 1"`, { slice: sliceID})

        const isInactive = (heartbeat.length < 1) && (latestInstance.length < 1) && (latestUser.length < 1) && (lastModified.length < 1)
        werft.log(sliceID, `Is inactive: ${isInactive}`)
        werft.done(sliceID)
        return isInactive
    } catch (err) {
        werft.log(sliceID, "Is inactive: false - Unable to check DB activity")
        werft.done(sliceID)
        return false
    }
}

async function removeCertificate(preview: string, kubectlConfig: string, slice: string) {
    exec(`kubectl --kubeconfig ${kubectlConfig} -n certs delete cert ${preview}`, {slice: slice})
}

// remove DNS records for core-dev-based preview environments
async function removeStagingDNSRecord(preview: string, sliceID: string) {
    werft.log(sliceID, "Deleting core-dev related DNS records for the preview environment")
    await Promise.all([
        deleteDNSRecord('A', `*.ws-dev.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `*.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `prometheus-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('TXT', `prometheus-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `grafana-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('TXT', `grafana-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('TXT', `_acme-challenge.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID),
        deleteDNSRecord('TXT', `_acme-challenge.ws-dev.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com', sliceID)
    ])
}

// remove DNS records for harvester-based preview environments
async function removePreviewDNSRecord(preview: string, sliceID: string) {
    werft.log(sliceID, "Deleting harvester related DNS records for the preview environment")
    await Promise.all([
        deleteDNSRecord('A', `*.ws-dev.${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `*.${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `prometheus-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
        deleteDNSRecord('TXT', `prometheus-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
        deleteDNSRecord('A', `grafana-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID),
        deleteDNSRecord('TXT', `grafana-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com', sliceID)
    ])
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
