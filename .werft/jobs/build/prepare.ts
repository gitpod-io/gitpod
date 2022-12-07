import {execStream} from "../../util/shell";
import {Werft} from "../../util/werft";
import {GCLOUD_SERVICE_ACCOUNT_PATH} from "./const";
import {JobConfig} from "./job-config";
import {certReady} from "../../util/certs";
import {vmExists} from "../../vm/vm";
import {configureAccess, configureDocker} from "../../util/preview";

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
        await configureAccess(werft)
        configureDocker();
        werft.done(prepareSlices.CONFIGURE_CORE_DEV);
        if (!config.withPreview) {
            return
        }
        await decideHarvesterVMCreation(werft, config);
        await certReady(werft, config, prepareSlices.WAIT_CERTIFICATES);
    } catch (err) {
        werft.fail(phaseName, err);
    }
    werft.done(phaseName);
}

async function decideHarvesterVMCreation(werft: Werft, config: JobConfig) {
    // always try to create - usually it will be no-op, but if tf changed for any reason we would reconcile
    if (config.withPreview && (!vmExists({name: config.previewEnvironment.destname}) || config.cleanSlateDeployment || config.recreatePreview || config.recreateVm)) {
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
        "TF_VAR_preview_name": config.previewEnvironment.destname,
        "TF_VAR_vm_cpu": `${cpu}`,
        "TF_VAR_vm_memory": `${memory}Gi`,
    }

    if (config.storageClass.length > 0) {
        environment["TF_VAR_vm_storage_class"] = config.storageClass
    }

    const variables = Object
        .entries(environment)
        .filter(([_, value]) => value.length > 0)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ")

    if (config.recreatePreview) {
        werft.log(prepareSlices.BOOT_VM, "Recreating environment");
        await execStream(`${variables} \
                                   leeway run dev/preview:delete-preview`, {slice: prepareSlices.BOOT_VM});
    } else if (config.cleanSlateDeployment || config.recreateVm) {
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
