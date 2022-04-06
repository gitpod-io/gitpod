import { exec } from '../../util/shell';
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

const phases = {
    PUBLISH_KOTS: 'publish kots',
};

const REPLICATED_DIR = './install/kots'
const REPLICATED_YAML_DIR = `${REPLICATED_DIR}/manifests`;
const INSTALLER_JOB_IMAGE = 'spec.template.spec.containers[0].image';

export async function publishKots(werft: Werft, config: JobConfig) {
    if (!config.publishToKots) {
        return;
    }

    werft.phase(phases.PUBLISH_KOTS, 'Publish release to KOTS');

    const imageAndTag = exec(`yq r ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE}`);
    const [image] = imageAndTag.split(':');

    // Set the tag to the current version
    exec(`yq w -i ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE} ${image}:${config.version}`);

    // Generate the logo
    exec(`make logo -C ${REPLICATED_DIR}`);

    // Update the additionalImages in the kots-app.yaml
    exec(`/tmp/installer mirror kots --file ${REPLICATED_YAML_DIR}/kots-app.yaml`);

    const replicatedChannel = config.mainBuild ? 'Unstable' : config.repository.branch;

    exec(`replicated release create \
        --lint \
        --ensure-channel \
        --yaml-dir ${REPLICATED_YAML_DIR} \
        --version ${config.version} \
        --release-notes "# ${config.version}\n\nSee [Werft job](https://werft.gitpod-dev.com/job/gitpod-build-${config.version}/logs) for notes" \
        --promote ${replicatedChannel}`);

    werft.done(phases.PUBLISH_KOTS);
}
