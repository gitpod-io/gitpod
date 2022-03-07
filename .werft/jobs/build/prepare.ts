import { exec } from '../../util/shell';
import { Werft } from "../../util/werft";
import { GCLOUD_SERVICE_ACCOUNT_PATH } from "./const";

const phaseName = "prepare";

export async function prepare(werft: Werft) {
    werft.phase(phaseName);
    try {
        compareWerftAndGitpodImage()
        activateCoreDevServiceAccount()
        configureDocker()
        configureCoreDevAccess()
    } catch (err) {
        werft.fail(phaseName, err);
    }
    werft.done(phaseName);
}

// TODO: The reasoning behind this step should be clarified
function compareWerftAndGitpodImage() {
    const werftImg = exec("cat .werft/build.yaml | grep dev-environment", { silent: true }).trim().split(": ")[1];
    const devImg = exec("yq r .gitpod.yml image", { silent: true }).trim();
    if (werftImg !== devImg) {
        throw new Error(`Werft job image (${werftImg}) and Gitpod dev image (${devImg}) do not match`);
    }
}

function activateCoreDevServiceAccount() {
    const rc = exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, { slice: phaseName }).code;

    if (rc != 0) {
        throw new Error("Failed to activate core-dev service account.")
    }
}

function configureDocker() {
    const rcDocker = exec("gcloud auth configure-docker --quiet", { slice: phaseName }).code;
    const rcDockerRegistry = exec("gcloud auth configure-docker europe-docker.pkg.dev --quiet", { slice: phaseName }).code;

    if (rcDocker != 0 || rcDockerRegistry != 0) {
        throw new Error("Failed to configure docker with gcloud.")
    }
}

function configureCoreDevAccess() {
    const rc = exec('gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev', { slice: phaseName }).code;

    if (rc != 0) {
        throw new Error("Failed to get core-dev kubeconfig credentials.")
    }
}