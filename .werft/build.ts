import * as fs from "fs";
import { SpanStatusCode } from "@opentelemetry/api";
import { FailedSliceError, Werft } from "./util/werft";
import { reportBuildFailureInSlack } from "./util/slack";
import * as Tracing from "./observability/tracing";
import * as VM from "./vm/vm";
import { buildAndPublish } from "./jobs/build/build-and-publish";
import { validateChanges } from "./jobs/build/validate-changes";
import { prepare } from "./jobs/build/prepare";
import { deployToPreviewEnvironment } from "./jobs/build/deploy-to-preview-environment";
import { runIntegrationTests } from "./jobs/build/trigger-integration-tests";
import { triggerSelfHostedPreview, triggerUpgradeTests } from "./jobs/build/self-hosted-upgrade-tests";
import { jobConfig } from "./jobs/build/job-config";

// Will be set once tracing has been initialized
let werft: Werft;
const context: any = JSON.parse(fs.readFileSync("context.json").toString());

Tracing.initialize()
    .then(() => {
        werft = new Werft("build");
    })
    .then(() => run(context))
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err,
        });

        if (err instanceof FailedSliceError) {
            // This error was produced using werft.fail which means that we
            // already handled it "gracefully"
        } else {
            console.log("Error", err);
        }

        if (context.Repository.ref === "refs/heads/main") {
            reportBuildFailureInSlack(context, err).catch((error: Error) => {
                console.error("Failed to send message to Slack", error);
            });
        }

        // Explicitly not using process.exit as we need to flush tracing, see tracing.js
        process.exitCode = 1;
    })
    .finally(() => {
        werft.phase("Stop kubectl port forwards", "Stopping kubectl port forwards");
        VM.stopKubectlPortForwards();

        werft.phase("Flushing telemetry", "Flushing telemetry before stopping job");
        werft.endAllSpans();
    });

async function run(context: any) {
    const config = jobConfig(werft, context);

    if(config.withGitHubActions) {
        werft.phase("Build Disabled");
        werft.log("(not building)","The build is being performed via GitHub Actions; Thus, this Werft build does not run");
        werft.done("(not building)");
        return;
    }

    await validateChanges(werft, config);
    await prepare(werft, config);
    if (config.withUpgradeTests) {
        // this will trigger an upgrade test on a self-hosted gitpod instance on a new cluster.
        await triggerUpgradeTests(werft, config, context.Owner);
        return;
    }

    await buildAndPublish(werft, config);

    if (config.withSelfHostedPreview) {
        await triggerSelfHostedPreview(werft, config, context.Owner);
        return;
    }

    if (!config.withPreview || config.publishRelease) {
        werft.phase("deploy", "not deploying");
        console.log("running without preview environment or publish-release is set");
        return;
    }

    try {
        await deployToPreviewEnvironment(werft, config);
    } catch (e) {
        // We currently don't support concurrent deployments to the same preview environment.
        // Until we do we don't want errors to mark the main build as failed.
        if (config.mainBuild) {
            return;
        }
        throw e;
    }

    await runIntegrationTests(werft, config, context.Owner);
}
