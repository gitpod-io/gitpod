import { previewNameFromBranchName } from "../../util/preview";
import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { CORE_DEV_KUBECONFIG_PATH, GCLOUD_SERVICE_ACCOUNT_PATH, HARVESTER_KUBECONFIG_PATH } from "./const";
import { issueMetaCerts } from "./deploy-to-preview-environment";
import { JobConfig } from "./job-config";

const phaseName = "prepare";
const prepareSlices = {
    CONFIGURE_CORE_DEV: "Configuring core-dev access.",
    BOOT_VM: "Booting VM.",
    ISSUE_CERTIFICATES: "Issuing certificates for the preview.",
};

export async function prepare(werft: Werft, config: JobConfig) {

    werft.phase(phaseName);
    try {
        werft.log(prepareSlices.CONFIGURE_CORE_DEV, prepareSlices.CONFIGURE_CORE_DEV);
        activateCoreDevServiceAccount();
        configureDocker();
        configureStaticClustersAccess();
        werft.done(prepareSlices.CONFIGURE_CORE_DEV);
        if (!config.withPreview)
        {
            return
        }
        var certReady = issueCertificate(werft, config);
        decideHarvesterVMCreation(werft, config);
        await certReady
    } catch (err) {
        werft.fail(phaseName, err);
    }
    werft.done(phaseName);
}

function activateCoreDevServiceAccount() {
    const rc = exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, {
        slice: prepareSlices.CONFIGURE_CORE_DEV,
    }).code;

    if (rc != 0) {
        throw new Error("Failed to activate core-dev service account.");
    }
}

function configureDocker() {
    const rcDocker = exec("gcloud auth configure-docker --quiet", { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;
    const rcDockerRegistry = exec("gcloud auth configure-docker europe-docker.pkg.dev --quiet", {
        slice: prepareSlices.CONFIGURE_CORE_DEV,
    }).code;

    if (rcDocker != 0 || rcDockerRegistry != 0) {
        throw new Error("Failed to configure docker with gcloud.");
    }
}

function configureStaticClustersAccess() {
    const rcCoreDev = exec(
        `KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev`,
        { slice: prepareSlices.CONFIGURE_CORE_DEV },
    ).code;
    if (rcCoreDev != 0) {
        throw new Error("Failed to get core-dev kubeconfig credentials.");
    }

    const rcHarvester = exec(
        `cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`,
        { slice: prepareSlices.CONFIGURE_CORE_DEV },
    ).code;

    if (rcHarvester != 0) {
        throw new Error("Failed to get Harvester kubeconfig credentials.");
    }
}

async function issueCertificate(werft: Werft, config: JobConfig): Promise<boolean> {
    const certName = `harvester-${previewNameFromBranchName(config.repository.branch)}`;
    const domain = `${config.previewEnvironment.destname}.preview.gitpod-dev.com`;

    werft.log(prepareSlices.ISSUE_CERTIFICATES, prepareSlices.ISSUE_CERTIFICATES);
    var certReady = await issueMetaCerts(werft, certName, "certs", domain, config.repository.branch, prepareSlices.ISSUE_CERTIFICATES);
    werft.done(prepareSlices.ISSUE_CERTIFICATES);
    return certReady
}

function decideHarvesterVMCreation(werft: Werft, config: JobConfig) {
    // always try to create - usually it will be no-op, but if tf changed for any reason we would reconcile
    if (config.withPreview) {
        createVM(werft, config);
    }
    werft.done(prepareSlices.BOOT_VM);
}

// createVM only triggers the VM creation.
// Readiness is not guaranted.
function createVM(werft: Werft, config: JobConfig) {
    const cpu = config.withLargeVM ? 12 : 6;
    const memory = config.withLargeVM ? 24 : 12;

    // set some common vars for TF
    // We pass the GCP credentials explicitly, otherwise for some reason TF doesn't pick them up
    const commonVars = `GOOGLE_BACKEND_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                        TF_VAR_dev_kube_path=${CORE_DEV_KUBECONFIG_PATH} \
                        TF_VAR_harvester_kube_path=${HARVESTER_KUBECONFIG_PATH} \
                        TF_VAR_preview_name=${config.previewEnvironment.destname} \
                        TF_VAR_vm_cpu=${cpu} \
                        TF_VAR_vm_memory=${memory}Gi \
                        TF_VAR_vm_storage_class="longhorn-gitpod-k3s-202209251218-onereplica"`

    if (config.cleanSlateDeployment) {
        werft.log(prepareSlices.BOOT_VM, "Cleaning previously created VM");
        // -replace=... forces recreation of the resource
        exec(`${commonVars} \
                        TF_CLI_ARGS_plan="-replace=harvester_virtualmachine.harvester" \
                        ./dev/preview/workflow/preview/deploy-harvester.sh`,
            {slice: prepareSlices.BOOT_VM}
        );
    }

    werft.log(prepareSlices.BOOT_VM, "Creating  VM");

    try {
        exec(`${commonVars} \
                        ./dev/preview/workflow/preview/deploy-harvester.sh`,
            {slice: prepareSlices.BOOT_VM}
        );
    } catch (err) {
        werft.currentPhaseSpan.setAttribute("preview.created_vm", false);
        werft.fail(prepareSlices.BOOT_VM, new Error(`Failed creating VM: ${err}`))
        return;
    }

    werft.currentPhaseSpan.setAttribute("preview.created_vm", true);
}
