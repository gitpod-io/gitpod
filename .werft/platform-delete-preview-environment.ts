import { Werft } from "./util/werft";
import * as Tracing from "./observability/tracing";
import { HarvesterPreviewEnvironment, PreviewEnvironment } from "./util/preview";
import { SpanStatusCode } from "@opentelemetry/api";
import { exec } from "./util/shell";
import {
    CORE_DEV_KUBECONFIG_PATH,
    GCLOUD_SERVICE_ACCOUNT_PATH,
    GLOBAL_KUBECONFIG_PATH,
    HARVESTER_KUBECONFIG_PATH
} from "./jobs/build/const";
import * as fs from "fs";

// Will be set once tracing has been initialized
let werft: Werft;

const context: any = JSON.parse(fs.readFileSync("context.json").toString());
const annotations = context.Annotations || {};
const previewName = annotations["preview"] || "";
// for testing purposes
// if set to 'true' it shows only previews that would be deleted
const DRY_RUN = annotations["dry-run"] in annotations || false;

const SLICES = {
    VALIDATE_CONFIGURATION: "Validating configuration",
    CONFIGURE_K8S: "Configuring k8s access.",
    CONFIGURE_ACCESS: "Configuring access to relevant resources",
    INSTALL_HARVESTER_KUBECONFIG: "Install Harvester kubeconfig",
    DELETING_PREVIEW: `Deleting preview environment: ${previewName}`,
};

Tracing.initialize()
    .then(() => {
        werft = new Werft("delete-preview-environment");
    })
    .then(() => deletePreviewEnvironment())
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

async function deletePreviewEnvironment() {
    // Fail early if no preview was passed through annotations.
    werft.log(SLICES.VALIDATE_CONFIGURATION, "Validating annotations");
    if (previewName == "") {
        werft.fail(
            SLICES.VALIDATE_CONFIGURATION,
            "A preview name is required. Please inform the preview name with '-a preview=<name of the preview>'.",
        );
    }
    werft.done(SLICES.VALIDATE_CONFIGURATION);

    werft.phase("Configure access");
    try {
        exec(`gcloud auth activate-service-account --key-file "${GCLOUD_SERVICE_ACCOUNT_PATH}"`, {
            slice: SLICES.CONFIGURE_ACCESS,
        });
        exec(
            `KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} gcloud container clusters get-credentials core-dev --zone europe-west1-b --project gitpod-core-dev`,
            { slice: SLICES.CONFIGURE_ACCESS },
        );
        werft.done(SLICES.CONFIGURE_ACCESS);
    } catch (err) {
        werft.fail(SLICES.CONFIGURE_ACCESS, err);
    }

    werft.phase("Install Harvester kubeconfig");
    try {
        exec(`cp /mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml ${HARVESTER_KUBECONFIG_PATH}`, {
            slice: SLICES.INSTALL_HARVESTER_KUBECONFIG,
        });
        werft.done(SLICES.INSTALL_HARVESTER_KUBECONFIG);
    } catch (err) {
        werft.fail(SLICES.INSTALL_HARVESTER_KUBECONFIG, err);
    }

    configureGlobalKubernetesContext()

    const preview = new HarvesterPreviewEnvironment(werft, previewName);
    if (DRY_RUN) {
        werft.log(SLICES.DELETING_PREVIEW, `Would have deleted preview ${preview.name}`);
    } else {
        removePreviewEnvironment(preview);
    }
}

function configureGlobalKubernetesContext() {
    exec(`leeway run dev/preview/previewctl:install`, {slice: "Install previewctl", dontCheckRc: false})
    const rc = exec(`KUBECONFIG=${GLOBAL_KUBECONFIG_PATH} previewctl get-credentials --gcp-service-account=${GCLOUD_SERVICE_ACCOUNT_PATH}`, { slice: SLICES.CONFIGURE_K8S }).code;

    if (rc != 0) {
        throw new Error("Failed to configure global kubernetes context.");
    }
}

async function removePreviewEnvironment(previewEnvironment: PreviewEnvironment) {
    werft.log(SLICES.DELETING_PREVIEW, `Starting deletion of all resources related to ${previewEnvironment.name}`);
    try {
        // We're running these promises sequentially to make it easier to read the log output.
        await previewEnvironment.delete();
        werft.done(SLICES.DELETING_PREVIEW);
    } catch (e) {
        werft.failSlice(SLICES.DELETING_PREVIEW, e);
    }
}
