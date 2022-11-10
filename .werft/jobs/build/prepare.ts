import {exec, execStream} from "../../util/shell";
import { Werft } from "../../util/werft";
import {
    CORE_DEV_KUBECONFIG_PATH,
    GCLOUD_SERVICE_ACCOUNT_PATH,
    GLOBAL_KUBECONFIG_PATH,
    HARVESTER_KUBECONFIG_PATH
} from "./const";
import { JobConfig } from "./job-config";
import {certReady} from "../../util/certs";
import {vmExists} from "../../vm/vm";

const phaseName = "prepare";
const prepareSlices = {
    CONFIGURE_K8S: "Configuring k8s access.",
    CONFIGURE_CORE_DEV: "Configuring core-dev access.",
    BOOT_VM: "Booting VM.",
    WAIT_CERTIFICATES: "Waiting for certificates to be ready for the preview.",
};

export async function prepare(werft: Werft, config: JobConfig) {
    werft.phase(phaseName);
    try {
        werft.log(prepareSlices.CONFIGURE_CORE_DEV, prepareSlices.CONFIGURE_CORE_DEV);
        activateCoreDevServiceAccount();
        configureDocker();
        configureStaticClustersAccess();
        configureGlobalKubernetesContext();
        werft.done(prepareSlices.CONFIGURE_CORE_DEV);
        if (!config.withPreview)
        {
            return
        }
        await decideHarvesterVMCreation(werft, config);
        await certReady(werft, config, prepareSlices.WAIT_CERTIFICATES);
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

function configureGlobalKubernetesContext() {
    const rc = exec(`previewctl get-credentials --gcp-service-account=${GCLOUD_SERVICE_ACCOUNT_PATH} --kube-save-path=${GLOBAL_KUBECONFIG_PATH}`, { slice: prepareSlices.CONFIGURE_K8S }).code;

    if (rc != 0) {
        throw new Error("Failed to configure global kubernetes context.");
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

async function decideHarvesterVMCreation(werft: Werft, config: JobConfig) {
    // always try to create - usually it will be no-op, but if tf changed for any reason we would reconcile
    if (config.withPreview && (!vmExists({ name: config.previewEnvironment.destname }) || config.cleanSlateDeployment || config.recreatePreview || config.recreateVm)) {
        await createVM(werft, config);
    }
    werft.done(prepareSlices.BOOT_VM);
}

// createVM only triggers the VM creation.
// Readiness is not guaranted.
async function createVM(werft: Werft, config: JobConfig) {
    const cpu = config.withLargeVM ? 12 : 6;
    const memory = config.withLargeVM ? 24 : 12;

    const environment = {
        // We pass the GCP credentials explicitly, otherwise for some reason TF doesn't pick them up
        "GOOGLE_BACKEND_CREDENTIALS": GCLOUD_SERVICE_ACCOUNT_PATH,
        "GOOGLE_APPLICATION_CREDENTIALS": GCLOUD_SERVICE_ACCOUNT_PATH,
        "TF_VAR_cert_issuer": config.certIssuer,
        "TF_VAR_kubeconfig_path": GLOBAL_KUBECONFIG_PATH,
        "TF_VAR_preview_name": config.previewEnvironment.destname,
        "TF_VAR_vm_cpu": `${cpu}`,
        "TF_VAR_vm_memory": `${memory}Gi`,
        "TF_VAR_vm_storage_class": "longhorn-gitpod-k3s-202209251218-onereplica"
    }

    const variables = Object
        .entries(environment)
        .filter(([_, value]) => value.length > 0)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ")

    if (config.recreatePreview){
        werft.log(prepareSlices.BOOT_VM, "Recreating environment");
        await execStream(`${variables} \
                                   leeway run dev/preview:delete-preview`, {slice: prepareSlices.BOOT_VM});
    }else if (config.cleanSlateDeployment || config.recreateVm) {
        werft.log(prepareSlices.BOOT_VM, "Cleaning previously created VM");
        // -replace=... forces recreation of the resource
        await execStream(`${variables} \
                                   TF_CLI_ARGS_plan=-replace=harvester_virtualmachine.harvester \
                                   leeway run dev/preview:create-preview`, {slice: prepareSlices.BOOT_VM});
    }

    werft.log(prepareSlices.BOOT_VM, "Creating  VM");

    try {
        await execStream(`${variables} leeway run dev/preview:create-preview`, {slice: prepareSlices.BOOT_VM});
    } catch (err) {
        werft.currentPhaseSpan.setAttribute("preview.created_vm", false);
        werft.fail(prepareSlices.BOOT_VM, new Error(`Failed creating VM: ${err}`))
        return;
    }

    werft.currentPhaseSpan.setAttribute("preview.created_vm", true);
}
