import * as fs from 'fs';
import { SpanStatusCode } from '@opentelemetry/api';
import { Werft } from './util/werft';
import { reportBuildFailureInSlack } from './util/slack';
import * as Tracing from './observability/tracing'
import * as VM from './vm/vm'
import { buildAndPublish } from './jobs/build/build-and-publish';
import { validateChanges } from './jobs/build/validate-changes';
import { prepare } from './jobs/build/prepare';
import { coverage } from './jobs/build/coverage';
import { deployToPreviewEnvironment } from './jobs/build/deploy-to-preview-environment';
import { triggerIntegrationTests } from './jobs/build/trigger-integration-tests';
import { jobConfig } from './jobs/build/job-config';

// Will be set once tracing has been initialized
let werft: Werft
const context: any = JSON.parse(fs.readFileSync('context.json').toString());

Tracing.initialize()
    .then(() => {
        werft = new Werft("build")
    })
    .then(() => run(context))
    .then(() => VM.stopKubectlPortForwards())
    .then(() => werft.endAllSpans())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err
        })
        werft.endAllSpans()

        if (context.Repository.ref === "refs/heads/main") {
            reportBuildFailureInSlack(context, err, () => process.exit(1));
        } else {
            console.log('Error', err)
            // Explicitly not using process.exit as we need to flush tracing, see tracing.js
            process.exitCode = 1
        }

        VM.stopKubectlPortForwards()
    })

async function run(context: any) {
    const config = jobConfig(werft, context)

    //TODO: This is only a temporary solution and needs to be removed when we migrate to one prev-environment per cluster
    // Because of a workspace label the branch name that can be used to create a preview environment is limited to 20 chars
    // echo -n "gitpod.io/registry-facade_ready_ns_staging-" | wc -c
    if (!config.noPreview) {
        werft.phase("check-branchname","This checks if the branchname is to long to create a preview-environment successfully.")
        const maxBranchNameLength = 20;
        if (config.previewEnvironment.destname.length > maxBranchNameLength) {
            werft.fail("check-branchname", `The branch name ${config.previewEnvironment.destname} is more than ${maxBranchNameLength} character. Please choose a shorter name!`)
        }
        werft.done("check-branchname")
    }


    await validateChanges(werft)
    await prepare(werft)
    await buildAndPublish(werft, config)
    await coverage(werft, config)

    if (config.noPreview) {
        werft.phase("deploy", "not deploying");
        console.log("no-preview or publish-release is set");
        return
    }

    await deployToPreviewEnvironment(werft, config)
    await triggerIntegrationTests(werft, config, context.Owner)
}
