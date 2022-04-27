import { Werft } from '../../util/werft';
import { JobConfig } from './job-config';

export async function runNightlyTests(werft: Werft, jobConfig: JobConfig) {
    werft.log("nightly-build", "nightly build triggered")
    console.log(jobConfig.withNightlyTests)
    return
}
