import { exec } from '../../util/shell';
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

const phases = {
    PUBLISH_KOTS: 'publish kots',
};

const REPLICATED_SECRET = 'replicated';
const REPLICATED_YAML_DIR = './install/kots/manifests';
const INSTALLER_JOB_IMAGE = 'spec.template.spec.containers[0].image';

export async function publishKots(werft: Werft, config: JobConfig) {
    werft.phase(phases.PUBLISH_KOTS, 'Publish release to KOTS');

    const imageAndTag = exec(`yq r ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE}`);
    const [image] = imageAndTag.split(':');

    // Set the tag to the current version
    exec(`yq w -i ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE} ${image}:${config.version}`);

    // Update the additionalImages in the kots-app.yaml
    exec(`/tmp/installer mirror kots --file ${REPLICATED_YAML_DIR}/kots-app.yaml`);

    const app = exec(`kubectl get secret ${REPLICATED_SECRET} --namespace werft -o jsonpath='{.data.app}' | base64 -d`);
    const token = exec(`kubectl get secret ${REPLICATED_SECRET} --namespace werft -o jsonpath='{.data.token}' | base64 -d`);

    const replicatedChannel = config.mainBuild ? 'Unstable' : config.repository.branch;

    exec(`replicated release create \
        --lint \
        --ensure-channel \
        --app ${app} \
        --token ${token} \
        --yaml-dir ${REPLICATED_YAML_DIR} \
        --version ${config.version} \
        --release-notes "# ${config.version}\n\nSee [Werft job](https://werft.gitpod-dev.com/job/gitpod-build-${config.version}/logs) for notes" \
        --promote ${replicatedChannel}`);

    werft.done(phases.PUBLISH_KOTS);
}
