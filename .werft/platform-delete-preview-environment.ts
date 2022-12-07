import {Werft} from "./util/werft";
import * as Tracing from "./observability/tracing";
import {configureGlobalKubernetesContext, HarvesterPreviewEnvironment} from "./util/preview";
import {SpanStatusCode} from "@opentelemetry/api";
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

    await configureGlobalKubernetesContext(werft)

    const preview = new HarvesterPreviewEnvironment(werft, previewName);
    if (DRY_RUN) {
        werft.log(SLICES.DELETING_PREVIEW, `Would have deleted preview ${preview.name}`);
    } else {
        werft.log(SLICES.DELETING_PREVIEW, `Starting deletion of all resources related to ${preview.name}`);
        try {
            // We're running these promises sequentially to make it easier to read the log output.
            await preview.delete();
            werft.done(SLICES.DELETING_PREVIEW);
        } catch (e) {
            werft.failSlice(SLICES.DELETING_PREVIEW, e);
        }
    }
}
