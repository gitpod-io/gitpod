import { exec } from '../../util/shell';
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

const phases = {
    PUBLISH_KOTS_UNSTABLE: 'publish kots unstable',
};

const REPLICATED_SECRET = 'replicated';
const REPLICATED_CHANNEL = 'Unstable';
const REPLICATED_YAML_DIR = './install/kots/manifests';
const INSTALLER_JOB_IMAGE = 'spec.template.spec.containers[0].image';

export async function publishKotsUnstable(werft: Werft, config: JobConfig) {
    // if (config.mainBuild) {
        werft.phase(phases.PUBLISH_KOTS_UNSTABLE, 'Publish unstable release to KOTS');

        const imageAndTag = exec(`yq r ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE}`);
        const [image] = imageAndTag.split(':');

        // Set the tag to the current version
        exec(`yq w -i ${REPLICATED_YAML_DIR}/gitpod-installer-job.yaml ${INSTALLER_JOB_IMAGE} ${image}:${config.version}`);

        const app = exec(`kubectl get secret ${REPLICATED_SECRET} --namespace werft -o jsonpath='{.data.app}' | base64 -d`);
        const token = exec(`kubectl get secret ${REPLICATED_SECRET} --namespace werft -o jsonpath='{.data.token}' | base64 -d`);

        exec(`replicated release create \
            --lint \
            --ensure-channel \
            --app ${app} \
            --token ${token} \
            --yaml-dir ${REPLICATED_YAML_DIR} \
            --version ${config.version} \
            --release-notes "# ${config.version}\n\nSee [Werft job](https://werft.gitpod-dev.com/job/gitpod-build-${config.version}/logs) for notes" \
            --promote ${REPLICATED_CHANNEL}`);

        werft.done(phases.PUBLISH_KOTS_UNSTABLE);
    // }
}
