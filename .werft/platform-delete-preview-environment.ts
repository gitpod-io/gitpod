import { Werft } from "./util/werft";
import * as Tracing from "./observability/tracing";
import { HarvesterPreviewEnvironment, PreviewEnvironment } from "./util/preview";
import { SpanStatusCode } from "@opentelemetry/api";
import { exec } from "./util/shell";
import { CORE_DEV_KUBECONFIG_PATH, HARVESTER_KUBECONFIG_PATH } from "./jobs/build/const";
import * as fs from "fs";

// for testing purposes
// if set to 'true' it shows only previews that would be deleted
const DRY_RUN = true;

// Will be set once tracing has been initialized
let werft: Werft;

const context: any = JSON.parse(fs.readFileSync("context.json").toString());
const annotations = context.Annotations || {};
const previewName = annotations["preview"] || "";

const SLICES = {
    VALIDATE_CONFIGURATION: "Validating configuration",
    CONFIGURE_ACCESS: "Configuring access to relevant resources",
    INSTALL_HARVESTER_KUBECONFIG: "Install Harvester kubeconfig",
    DELETING_PREVIEW: `Deleting preview environment: ${previewName}`,
};

Tracing.initialize()
    .then(() => {
        werft = new Werft("delete-preview-environment-cron");
    })
    .then(() => deletePreviewEnvironment())
    .then(() => cleanLoadbalancer())
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
        const GCLOUD_SERVICE_ACCOUNT_PATH = "/mnt/secrets/gcp-sa/service-account.json";
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

    const preview = new HarvesterPreviewEnvironment(werft, previewName);
    if (DRY_RUN) {
        werft.log(SLICES.DELETING_PREVIEW, `Would have deleted preview ${preview.name}`);
    } else {
        removePreviewEnvironment(preview);
    }
}

async function removePreviewEnvironment(previewEnvironment: PreviewEnvironment) {
    werft.log(SLICES.DELETING_PREVIEW, `Starting deletion of all resources related to ${previewEnvironment.name}`);
    try {
        // We're running these promises sequentially to make it easier to read the log output.
        await previewEnvironment.removeDNSRecords(SLICES.DELETING_PREVIEW);
        await previewEnvironment.delete();
        werft.done(SLICES.DELETING_PREVIEW);
    } catch (e) {
        werft.failSlice(SLICES.DELETING_PREVIEW, e);
    }
}

async function cleanLoadbalancer() {
    const fetchPhase = "fetching unuse loadbalancer";
    const deletionPhase = "deleting unused load balancers";

    werft.phase(fetchPhase);
    let lbsToDelete: string[];
    try {
        // get all loadbalancer
        let lbs: string[] = exec(
            `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get deployment -n loadbalancers -o=jsonpath="{.items[*].metadata.labels['gitpod\\.io\\/lbName']}"`,
            { silent: true },
        )
            .stdout.trim()
            .split(" ");
        let previews = exec(
            `kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} get namespaces -o go-template --template '{{range .items}}{{.metadata.name}}{{"\\n"}}{{end}}' | awk '/(preview-.*)/ { print $1 }'`,
            { silent: true },
        )
            .stdout.trim()
            .split("\n");
        let previewSet = new Set(previews);
        lbsToDelete = lbs.filter((lb) => !previewSet.has("preview-" + lb));
        lbsToDelete.forEach((lb) => werft.log(fetchPhase, "will delete " + lb));
    } catch (err) {
        werft.fail(fetchPhase, err);
    }

    werft.phase(deletionPhase);
    try {
        lbsToDelete.forEach((lb) => {
            werft.log(deletionPhase, "deleteing " + lb);
            exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers delete deployment lb-${lb}`);
            exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n loadbalancers delete service lb-${lb}`);
        });
    } catch (err) {
        werft.fail(deletionPhase, err);
    }
    werft.done(deletionPhase);
}
