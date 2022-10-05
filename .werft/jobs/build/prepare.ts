import {previewNameFromBranchName} from "../../util/preview";
import {exec} from "../../util/shell";
import {Werft} from "../../util/werft";
import * as VM from "../../vm/vm";
import {CORE_DEV_KUBECONFIG_PATH, GCLOUD_SERVICE_ACCOUNT_PATH, HARVESTER_KUBECONFIG_PATH} from "./const";
import {issueMetaCerts} from "./deploy-to-preview-environment";
import {JobConfig} from "./job-config";

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
        if (!config.withPreview) {
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
    const rcDocker = exec("gcloud auth configure-docker --quiet", {slice: prepareSlices.CONFIGURE_CORE_DEV}).code;
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
        {slice: prepareSlices.CONFIGURE_CORE_DEV},
    ).code;
    if (rcCoreDev != 0) {
        throw new Error("Failed to get core-dev kubeconfig credentials.");
    }

    const rcHarvester = exec(
        `cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`,
        {slice: prepareSlices.CONFIGURE_CORE_DEV},
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
    if (shouldCreateVM(config)) {
        createVM(werft, config);
    }
    // applyLoadBalancer({ name: config.previewEnvironment.destname });
    werft.done(prepareSlices.BOOT_VM);
}

function shouldCreateVM(config: JobConfig) {
    return (
        config.withPreview &&
        (!VM.vmExists({name: config.previewEnvironment.destname}) || config.cleanSlateDeployment)
    );
}

// createVM only triggers the VM creation.
// Readiness is not guaranted.
function createVM(werft: Werft, config: JobConfig) {
    const kubepaths = `TF_VAR_dev_kube_path=${HARVESTER_KUBECONFIG_PATH} TF_VAR_harvester_kube_path=${CORE_DEV_KUBECONFIG_PATH}`
    if (config.cleanSlateDeployment) {
        werft.log(prepareSlices.BOOT_VM, "Cleaning previously created VM");
        // VM.deleteVM({name: config.previewEnvironment.destname});
        exec(`DESTROY=true ${kubepaths} TF_VAR_preview_name=${config.previewEnvironment.destname} ./dev/preview/workflow/preview/deploy-harvester.sh`, {slice: prepareSlices.BOOT_VM});
    }

    werft.log(prepareSlices.BOOT_VM, "Creating  VM");
    const cpu = config.withLargeVM ? 12 : 6;
    const memory = config.withLargeVM ? 24 : 12;

    const createVM = exec(`${kubepaths} TF_VAR_vm_cpu=${cpu} TF_VAR_vm_memory=${memory}Gi TF_VAR_preview_name=${config.previewEnvironment.destname} ./dev/preview/workflow/preview/deploy-harvester.sh`, {slice: prepareSlices.BOOT_VM});

    if (createVM.code > 0) {
        const err = new Error(`Failed creating VM`)
        createVM.stderr.split('\n').forEach(stderrLine => werft.log(prepareSlices.BOOT_VM, stderrLine))
        werft.failSlice(prepareSlices.BOOT_VM, err)
        return
    }

    // VM.startVM({name: config.previewEnvironment.destname, cpu, memory});
    werft.currentPhaseSpan.setAttribute("preview.created_vm", true);
}

// createVM only triggers the VM creation.
// Readiness is not guaranted.
// function createVM(werft: Werft, config: JobConfig) {
//     if (config.cleanSlateDeployment) {
//         werft.log(prepareSlices.BOOT_VM, "Cleaning previously created VM");
//         VM.deleteVM({ name: config.previewEnvironment.destname });
//     }
//
//     werft.log(prepareSlices.BOOT_VM, "Creating  VM");
//     const cpu = config.withLargeVM ? 12 : 6;
//     const memory = config.withLargeVM ? 24 : 12;
//     VM.startVM({ name: config.previewEnvironment.destname, cpu, memory });
//     werft.currentPhaseSpan.setAttribute("preview.created_vm", true);
// }

// function applyLoadBalancer(option: { name: string }) {
//     function kubectlApplyManifest(manifest: string, options?: { validate?: boolean }) {
//         exec(`
//             cat <<EOF | kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} apply --validate=${!!options?.validate} -f -
// ${manifest}
// EOF
//         `);
//     }
//
//     kubectlApplyManifest(Manifests.LBDeployManifest({name: option.name}));
//     kubectlApplyManifest(Manifests.LBServiceManifest({name: option.name}));
// }
