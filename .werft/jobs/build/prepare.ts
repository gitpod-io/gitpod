import { exec } from '../../util/shell';
import { Werft } from "../../util/werft";
import * as VM from '../../vm/vm'
import { GCLOUD_SERVICE_ACCOUNT_PATH } from "./const";
import { JobConfig } from './job-config';

const phaseName = "prepare";
const prepareSlices = {
    CONFIGURE_CORE_DEV: "Configuring core-dev access.",
    BOOT_VM: "Booting VM."
}

export async function prepare(werft: Werft, config: JobConfig) {
    werft.phase(phaseName);
    try {
        werft.log(prepareSlices.CONFIGURE_CORE_DEV, prepareSlices.CONFIGURE_CORE_DEV)
        compareWerftAndGitpodImage()
        activateCoreDevServiceAccount()
        configureDocker()
        configureCoreDevAccess()
        werft.done(prepareSlices.CONFIGURE_CORE_DEV)

        decideHarvesterVMCreation(werft, config)
    } catch (err) {
        werft.fail(phaseName, err);
    }
    werft.done(phaseName);
}

// We want to assure that our Workspace behaves the exactly same way as
// it behaves when running a werft job. Therefore, we want them to always be equal.
function compareWerftAndGitpodImage() {
    const werftImg = exec("cat .werft/build.yaml | grep dev-environment", { silent: true }).trim().split(": ")[1];
    const devImg = exec("yq r .gitpod.yml image", { silent: true }).trim();
    if (werftImg !== devImg) {
        throw new Error(`Werft job image (${werftImg}) and Gitpod dev image (${devImg}) do not match`);
    }
}

function activateCoreDevServiceAccount() {
    const rc = exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;

    if (rc != 0) {
        throw new Error("Failed to activate core-dev service account.")
    }
}

function configureDocker() {
    const rcDocker = exec("gcloud auth configure-docker --quiet", { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;
    const rcDockerRegistry = exec("gcloud auth configure-docker europe-docker.pkg.dev --quiet", { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;

    if (rcDocker != 0 || rcDockerRegistry != 0) {
        throw new Error("Failed to configure docker with gcloud.")
    }
}

function configureCoreDevAccess() {
    const rc = exec('gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev', { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;

    if (rc != 0) {
        throw new Error("Failed to get core-dev kubeconfig credentials.")
    }
}

function decideHarvesterVMCreation(werft: Werft, config: JobConfig) {
    if (config.withVM && !VM.vmExists({ name: config.previewEnvironment.destname })) {
        prepareVM(werft, config)
    } else {
        werft.currentPhaseSpan.setAttribute("werft.harvester.created_vm", false)
    }
    werft.done(prepareSlices.BOOT_VM)
}

function prepareVM(werft: Werft, config: JobConfig) {
    if (config.cleanSlateDeployment) {
        werft.log(prepareSlices.BOOT_VM, "Cleaning previously created VM")
        VM.deleteVM({ name: config.previewEnvironment.destname })
    }
    createVM(werft, config, prepareSlices.BOOT_VM)
}

// createVM only triggers the VM creation.
// Readiness is not guaranted.
function createVM(werft: Werft, config: JobConfig, slice: string) {
    werft.log(slice, 'Booting  VM')
    VM.startVM({ name: config.previewEnvironment.destname })
    werft.currentPhaseSpan.setAttribute("werft.harvester.created_vm", true)
}
