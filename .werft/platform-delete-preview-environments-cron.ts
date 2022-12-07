import {Werft} from "./util/werft";
import * as Tracing from "./observability/tracing";
import {SpanStatusCode} from "@opentelemetry/api";
import {exec, execStream} from "./util/shell";
import {configureAccess, HarvesterPreviewEnvironment, PreviewEnvironment} from "./util/preview";
import {GCLOUD_SERVICE_ACCOUNT_PATH} from "./jobs/build/const";
import * as fs from "fs";

const context: any = JSON.parse(fs.readFileSync("context.json").toString());
const annotations = context.Annotations || {};
// for testing purposes
// if set to 'true' it shows only previews that would be deleted
const DRY_RUN = annotations["dry-run"] in annotations || false;

const SLICES = {
    CONFIGURE_ACCESS: "Configuring access to relevant resources",
    INSTALL_HARVESTER_KUBECONFIG: "Install Harvester kubeconfig",
    FETCHING_PREVIEW_ENVIRONMENTS: "Fetching preview environments",
    FETCHING_BRANCHES: "Fetching branches",
    CHECKING_FOR_STALE_BRANCHES: "Checking for stale branches",
    CHECKING_FOR_DB_ACTIVITY: "Checking for DB activity",
    DETERMINING_STALE_PREVIEW_ENVIRONMENTS: "Determining stale preview environments",
    DELETING_PREVIEW_ENVIRONMNETS: "Deleting preview environments",
    DELETING_ORPHAN_CERTIFICATES: "Deleting certificates without a matching preview environment",
};

// Will be set once tracing has been initialized
let werft: Werft;

Tracing.initialize()
    .then(() => {
        werft = new Werft("delete-preview-environment-cron");
    })
    .then(() => deletePreviewEnvironments())
    .catch((err) => {
        werft.rootSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err,
        });
        console.error("Werft job failed with an error", err);
        // Explicitly not using process.exit as we need to flush tracing, see tracing.js
        process.exitCode = 1;
    })
    .finally(() => {
        werft.phase("Flushing telemetry", "Flushing telemetry before stopping job");
        werft.endAllSpans();
    });

async function getStalePreviewEnvironments(slice: string): Promise<PreviewEnvironment[]> {
    await execStream(
        `GOOGLE_APPLICATION_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                   previewctl list stale --private-key-path=/workspace/.ssh/id_rsa_harvester_vm > /tmp/stale`,
        {slice: slice},
    )

    const harvesterPreviewEnvironments = exec(`cat /tmp/stale`)
        .stdout.trim()
        .split("\n")
        .map((name) => new HarvesterPreviewEnvironment(werft, "preview-" + name.trim()));

    werft.currentPhaseSpan.setAttributes({
        "preview_environments.counts.stale.harvester": harvesterPreviewEnvironments.length,
    });

    return harvesterPreviewEnvironments;
}

async function deletePreviewEnvironments() {
    await configureAccess(werft)

    werft.phase("Fetching stale preview environments");
    let stalePreviews: PreviewEnvironment[];
    try {
        stalePreviews = await getStalePreviewEnvironments(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
        stalePreviews.forEach((preview: PreviewEnvironment) =>
            werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `${preview.name} (${preview.namespace})`),
        );
        werft.log(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, `Found ${stalePreviews.length} stale preview environments`);
        werft.done(SLICES.FETCHING_PREVIEW_ENVIRONMENTS);
    } catch (err) {
        werft.fail(SLICES.FETCHING_PREVIEW_ENVIRONMENTS, err);
    }

    werft.phase("Determining which preview environments are stale");

    if (stalePreviews.length == 0) {
        werft.log(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS, "No stale preview environments.");
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS);
        return;
    } else {
        werft.log(
            SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS,
            `Found ${stalePreviews.length} stale preview environments`,
        );
        werft.done(SLICES.DETERMINING_STALE_PREVIEW_ENVIRONMENTS);
    }

    try {
        const promises: Promise<any>[] = [];
        stalePreviews.forEach((preview) => promises.push(removePreviewEnvironment(preview)));
        await Promise.all(promises);
        werft.done(SLICES.DELETING_PREVIEW_ENVIRONMNETS);
    } catch (err) {
        werft.fail(SLICES.DELETING_PREVIEW_ENVIRONMNETS, err);
    }
}

async function removePreviewEnvironment(previewEnvironment: PreviewEnvironment) {
    const sliceID = `Deleting preview ${previewEnvironment.name}`;
    werft.log(sliceID, `Triggering job to delete ${previewEnvironment.name}. DRY_RUN=${DRY_RUN}`);
    try {
        const deleteJobURL = exec(
            `werft job run github -j .werft/platform-delete-preview-environment.yaml -a preview=${previewEnvironment.name} -a dry-run=${DRY_RUN}`,
            {slice: sliceID}
        ).stdout.trim()

        exec(`werft log result -d "Delete preview ${previewEnvironment.name} job" url "https://werft.gitpod-dev.com/job/${deleteJobURL}"`, {slice: sliceID})
        werft.done(sliceID);
    } catch (e) {
        werft.failSlice(sliceID, e);
    }
}
