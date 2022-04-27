import { Werft } from '../../util/werft';
import { JobConfig } from './job-config';

export async function runNightlyTests(werft: Werft, jobConfig: JobConfig) {
    werft.phase("nightly-build", "running self-hosted nightly build")

    werft.log("gke-cluster", "Create GKE cluster")
    werft.log("install-gitpod", "Install gitpod in the cluster")
}
