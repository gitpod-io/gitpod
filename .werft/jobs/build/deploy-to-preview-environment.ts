import * as fs from "fs";
import { exec } from "../../util/shell";
import { MonitoringSatelliteInstaller } from "../../observability/monitoring-satellite";

import { PREVIEW_K3S_KUBECONFIG_PATH } from "./const";
import { Werft } from "../../util/werft";
import { Analytics, JobConfig } from "./job-config";
import * as VM from "../../vm/vm";
import { Installer } from "./installer/installer";
import { previewNameFromBranchName } from "../../util/preview";
import { SpanStatusCode } from "@opentelemetry/api";

// used by Installer
const STACKDRIVER_SERVICEACCOUNT = JSON.parse(
    fs.readFileSync(`/mnt/secrets/monitoring-satellite-stackdriver-credentials/credentials.json`, "utf8"),
);

const phases = {
    DEPLOY: "deploy",
    VM: "Ensure VM Readiness",
};

const installerSlices = {
    INSTALL: "Generate, validate, and install Gitpod",
};

const vmSlices = {
    VM_READINESS: "Waiting for VM readiness",
    KUBECONFIG: "Getting kubeconfig",
};

interface DeploymentConfig {
    version: string;
    destname: string;
    namespace: string;
    domain: string;
    monitoringDomain: string;
    url: string;
    cleanSlateDeployment: boolean;
    installEELicense: boolean;
    withObservability: boolean;
    analytics: Analytics;
}

export async function deployToPreviewEnvironment(werft: Werft, jobConfig: JobConfig) {
    const { version, cleanSlateDeployment, withObservability, installEELicense, workspaceFeatureFlags } = jobConfig;

    const { destname, namespace } = jobConfig.previewEnvironment;

    const domain = `${destname}.preview.gitpod-dev.com`;
    const monitoringDomain = `${destname}.preview.gitpod-dev.com`;
    const url = `https://${domain}`;

    const deploymentConfig: DeploymentConfig = {
        version,
        destname,
        namespace,
        domain,
        monitoringDomain,
        url,
        cleanSlateDeployment,
        installEELicense,
        withObservability,
        analytics: jobConfig.analytics,
    };

    // We set all attributes to false as default and only set it to true once the each process is complete.
    // We only set the attribute for jobs where a VM is expected.
    werft.rootSpan.setAttributes({ "preview.monitoring_installed_successfully": false });

    werft.phase(phases.VM, "Ensuring VM is ready for deployment");

    werft.log(vmSlices.VM_READINESS, "Wait for VM readiness");
    VM.waitForVMReadiness({ name: destname, timeoutSeconds: 60 * 10, slice: vmSlices.VM_READINESS });
    werft.done(vmSlices.VM_READINESS);

    werft.log(vmSlices.KUBECONFIG, "Copying k3s kubeconfig");
    VM.copyk3sKubeconfigShell({ name: destname, timeoutMS: 1000 * 60 * 6, slice: vmSlices.KUBECONFIG });
    werft.done(vmSlices.KUBECONFIG);

    // Deploying monitoring satellite to VM-based preview environments is currently best-effort.
    // That means we currently don't wait for the promise here, and should the installation fail
    // we'll simply log an error rather than failing the build.
    //
    // Note: Werft currently doesn't support slices spanning across multiple phases so running this
    // can result in many 'observability' slices. Currently we close all the spans in a phase
    // when we complete a phase. This means we can't currently measure the full duration or the
    // success rate or installing monitoring satellite, but we can at least count and debug errors.
    // In the future we can consider not closing spans when closing phases, or restructuring our phases
    // based on parallelism boundaries
    const monitoringSatelliteInstaller = new MonitoringSatelliteInstaller({
        kubeconfigPath: PREVIEW_K3S_KUBECONFIG_PATH,
        branch: jobConfig.observability.branch,
        satelliteNamespace: deploymentConfig.namespace,
        clusterName: deploymentConfig.namespace,
        nodeExporterPort: 9100,
        previewDomain: deploymentConfig.domain,
        previewName: previewNameFromBranchName(jobConfig.repository.branch),
        stackdriverServiceAccount: STACKDRIVER_SERVICEACCOUNT,
        werft: werft,
    });
    const sliceID = "observability";
    monitoringSatelliteInstaller
        .install()
        .then(() => {
            werft.rootSpan.setAttributes({ "preview.monitoring_installed_successfully": true });
            werft.log(sliceID, "Succeeded installing monitoring satellite");
        })
        .catch((err) => {
            werft.log(sliceID, `Failed to install monitoring: ${err}`);
            const span = werft.getSpanForSlice(sliceID);
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err,
            });
        })
        .finally(() => werft.done(sliceID));

    werft.phase(phases.DEPLOY, "deploying to dev with Installer");

    const installer = new Installer({
        werft: werft,
        previewName: deploymentConfig.destname,
        version: deploymentConfig.version,
        analytics: deploymentConfig.analytics,
        withEELicense: deploymentConfig.installEELicense,
        workspaceFeatureFlags: workspaceFeatureFlags,
        withSlowDatabase: jobConfig.withSlowDatabase,
    });
    try {
        werft.log(phases.DEPLOY, "deploying using installer");
        await installer.install(installerSlices.INSTALL);
        exec(
            `werft log result -d "dev installation" -c github-check-preview-env url https://${deploymentConfig.domain}/workspaces`,
        );
    } catch (err) {
        werft.fail(installerSlices.INSTALL, err);
    }
}
