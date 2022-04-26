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

    werft.phase("Fetching previews");
    let previews: string[]
    try {
        previews = listAllPreviewNamespaces(CORE_DEV_KUBECONFIG_PATH, {});
        previews.forEach(previewNs => werft.log("Fetching preview", previewNs));
        werft.done("Fetching preview");
    } catch (err) {
        werft.fail("Fetching preview", err)
    }

    werft.phase("Fetching outdated branches");
    const branches = getAllBranches();
    const outdatedPreviews = new Set(branches
        .filter(branch => {
          const lastCommit = exec(`git log origin/${branch} --since=$(date +%Y-%m-%d -d "5 days ago")`, { silent: true })
          return lastCommit.length < 1
        })
        .map(branch => expectedNamespaceFromBranch(branch)))

    const expectedPreviewEnvironmentNamespaces = new Set(branches.map(branch => expectedNamespaceFromBranch(branch)));

    werft.phase("deleting previews")
    try {
        const deleteDueToMissingBranch     = previews.filter(ns => !expectedPreviewEnvironmentNamespaces.has(ns))
        const deleteDueToNoCommitActivity  = previews.filter(ns => outdatedPreviews.has(ns))
        const deleteDueToNoDBActivity      = previews.filter(ns => isInactive(ns))
        const previewsToDelete             = new Set([...deleteDueToMissingBranch, ...deleteDueToNoCommitActivity, ...deleteDueToNoDBActivity])

        if (previewsToDelete.has("staging-main")) {
            previewsToDelete.delete("staging-main")
        }

        if (DRY_RUN) {
            previewsToDelete.forEach(preview => werft.log("deleting preview", `would have deleted preview environment ${preview}`))
        }
        else {
            const promises: Promise<any>[] = [];
            previewsToDelete.forEach(preview => {
                werft.log("deleting preview", preview)
                promises.push(
                    removeCertificate(preview, CORE_DEV_KUBECONFIG_PATH),
                    removeStagingDNSRecord(preview),
                    wipePreviewEnvironmentAndNamespace(helmInstallName, preview, CORE_DEV_KUBECONFIG_PATH, { slice: `Deleting preview ${preview}` }))
            })
            await Promise.all(promises)
        }
        werft.done("deleting preview")
    } catch (err) {
        werft.fail("deleting preview", err)
    }
}


function isInactive(previewNS: string): boolean {

    const statusNS = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get ns ${previewNS} -o jsonpath='{.status.phase}'`, { silent: true})

    if ( statusNS == "Active") {

        const emptyNS = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods -n ${previewNS} -o jsonpath='{.items.*}'`, { silent: true})

        if ( emptyNS.length < 1 ) {
            return false;
        }

        const statusDB = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods mysql-0 -n ${previewNS} -o jsonpath='{.status.phase}'`, { silent: true})
        const statusDbContainer = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get pods mysql-0 -n ${previewNS} -o jsonpath='{.status.containerStatuses.*.ready}'`, { silent: true})

        if (statusDB.code == 0 && statusDB == "Running" && statusDbContainer != "false") {

            const connectionToDb = `KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} kubectl get secret db-password -n ${previewNS} -o jsonpath='{.data.mysql-root-password}' | base64 -d | mysql --host=db.${previewNS}.svc.cluster.local --port=3306 --user=root --database=gitpod -s -N -p`

            const latestInstanceTimeout = 24
            const latestInstance = exec(`${connectionToDb} --execute="SELECT creationTime FROM d_b_workspace_instance WHERE creationTime > DATE_SUB(NOW(), INTERVAL '${latestInstanceTimeout}' HOUR) LIMIT 1"`, { silent: true })

            const latestUserTimeout = 24
            const latestUser= exec(`${connectionToDb} --execute="SELECT creationDate FROM d_b_user WHERE creationDate > DATE_SUB(NOW(), INTERVAL '${latestUserTimeout}' HOUR) LIMIT 1"`, { silent: true })

            const lastModifiedTimeout = 24
            const lastModified= exec(`${connectionToDb} --execute="SELECT _lastModified FROM d_b_user WHERE _lastModified > DATE_SUB(NOW(), INTERVAL '${lastModifiedTimeout}' HOUR) LIMIT 1"`, { silent: true })

            const heartbeatTimeout = 24
            const heartbeat= exec(`${connectionToDb} --execute="SELECT lastSeen FROM d_b_workspace_instance_user WHERE lastSeen > DATE_SUB(NOW(), INTERVAL '${heartbeatTimeout}' HOUR) LIMIT 1"`, { silent: true })

            if ( (heartbeat.length      < 1) &&
                 (latestInstance.length < 1) &&
                 (latestUser.length     < 1) &&
                 (lastModified.length   < 1) ) {
                return true;
            } else {
                return false;
            }
        }
    }

}

async function removeCertificate(preview: string, kubectlConfig: string) {
    exec(`kubectl --kubeconfig ${kubectlConfig} -n certs delete cert ${preview}`)
    return
}

// remove DNS records on the old generation of preview environments
async function removeStagingDNSRecord(preview: string) {
    return Promise.all([
        deleteDNSRecord('A', `*.ws-dev.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('A', `*.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('A', `${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('A', `prometheus-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('TXT', `prometheus-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('A', `grafana-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('TXT', `grafana-${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('TXT', `_acme-challenge.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com'),
        deleteDNSRecord('TXT', `_acme-challenge.ws-dev.${preview}.staging.gitpod-dev.com`, 'gitpod-dev', 'gitpod-dev-com')
    ])
}

// remove DNS records on the new (Harvester based) generation of preview environments
async function removePreviewDNSRecord(preview: string) {
    return Promise.all([
        deleteDNSRecord('A', `*.ws-dev.${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com'),
        deleteDNSRecord('A', `*.${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com'),
        deleteDNSRecord('A', `${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com'),
        deleteDNSRecord('A', `prometheus-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com'),
        deleteDNSRecord('TXT', `prometheus-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com'),
        deleteDNSRecord('A', `grafana-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com'),
        deleteDNSRecord('TXT', `grafana-${preview}.preview.gitpod-dev.com`, 'gitpod-core-dev', 'preview-gitpod-dev-com')
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
