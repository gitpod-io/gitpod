import { previewNameFromBranchName } from '../../util/preview';
import { exec } from '../../util/shell';
import { Werft } from "../../util/werft";
import * as VM from '../../vm/vm'
import { CORE_DEV_KUBECONFIG_PATH, GCLOUD_SERVICE_ACCOUNT_PATH, HARVESTER_KUBECONFIG_PATH } from "./const";
import { issueMetaCerts } from './deploy-to-preview-environment';
import { JobConfig } from './job-config';

const phaseName = "prepare";
const prepareSlices = {
    CONFIGURE_CORE_DEV: "Configuring core-dev access.",
    BOOT_VM: "Booting VM.",
    ISSUE_CERTIFICATES: "Issuing certificates for the preview."
}

export async function prepare(werft: Werft, config: JobConfig) {
    werft.phase(phaseName);
    try {
        werft.log(prepareSlices.CONFIGURE_CORE_DEV, prepareSlices.CONFIGURE_CORE_DEV)
        compareWerftAndGitpodImage()
        activateCoreDevServiceAccount()
        configureDocker()
        configureStaticClustersAccess()
        werft.done(prepareSlices.CONFIGURE_CORE_DEV)

        issueCertificate(werft, config)
        decideHarvesterVMCreation(werft, config)
    } catch (err) {
        werft.fail(phaseName, err);
    }
    werft.endPhase(phaseName);
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

function configureStaticClustersAccess() {
    const rcCoreDev = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev`, { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;
    if (rcCoreDev != 0) {
        throw new Error("Failed to get core-dev kubeconfig credentials.")
    }

    const rcHarvester = exec(`cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`, { slice: prepareSlices.CONFIGURE_CORE_DEV }).code;

    if (rcHarvester != 0) {
        throw new Error("Failed to get Harvester kubeconfig credentials.")
    }
}

function issueCertificate(werft: Werft, config: JobConfig) {
    const certName = config.withVM ? `harvester-${previewNameFromBranchName(config.repository.branch)}` : `staging-${previewNameFromBranchName(config.repository.branch)}`
    const domain = config.withVM ? `${config.previewEnvironment.destname}.preview.gitpod-dev.com` : `${config.previewEnvironment.destname}.staging.gitpod-dev.com`;

    werft.log(prepareSlices.ISSUE_CERTIFICATES, prepareSlices.ISSUE_CERTIFICATES)
    issueMetaCerts(werft, certName, "certs", domain, config.withVM, prepareSlices.ISSUE_CERTIFICATES)
    werft.done(prepareSlices.ISSUE_CERTIFICATES)
}

function decideHarvesterVMCreation(werft: Werft, config: JobConfig) {
    if (shouldCreateVM(config)) {
        createVM(werft, config)
    } else {
        werft.phases[werft.currentPhase].span.setAttribute("werft.harvester.created_vm", false)
    }
    werft.done(prepareSlices.BOOT_VM)
}

function shouldCreateVM(config: JobConfig) {
    return config.withVM && (
        !VM.vmExists({ name: config.previewEnvironment.destname }) ||
        config.cleanSlateDeployment
    )
}

// createVM only triggers the VM creation.
// Readiness is not guaranted.
function createVM(werft: Werft, config: JobConfig) {
    if (config.cleanSlateDeployment) {
        werft.log(prepareSlices.BOOT_VM, "Cleaning previously created VM")
        VM.deleteVM({ name: config.previewEnvironment.destname })
    }

    werft.log(prepareSlices.BOOT_VM, 'Creating  VM')
    VM.startVM({ name: config.previewEnvironment.destname })
    werft.phases[werft.currentPhase].span.setAttribute("werft.harvester.created_vm", true)
}
