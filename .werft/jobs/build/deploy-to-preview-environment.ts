import * as fs from "fs";
import { exec } from "../../util/shell";
import { MonitoringSatelliteInstaller } from "../../observability/monitoring-satellite";

import { Werft } from "../../util/werft";
import { Analytics, JobConfig } from "./job-config";
import * as VM from "../../vm/vm";
import { Installer } from "./installer/installer";
import { previewNameFromBranchName } from "../../util/preview";

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

    werft.log(vmSlices.KUBECONFIG, "Installing preview context");
    await VM.installPreviewContext({ name: destname, slice: vmSlices.KUBECONFIG });
    werft.done(vmSlices.KUBECONFIG);

    werft.phase(phases.DEPLOY, "Deploying Gitpod and Observability Stack");

    const installMonitoringSatellite = (async () => {
        const sliceID = "Install monitoring satellite";
        const monitoringSatelliteInstaller = new MonitoringSatelliteInstaller({
            branch: jobConfig.observability.branch,
            previewName: previewNameFromBranchName(jobConfig.repository.branch),
            stackdriverServiceAccount: STACKDRIVER_SERVICEACCOUNT,
            werft: werft,
        });
        try {
            await monitoringSatelliteInstaller.install(sliceID);
            werft.rootSpan.setAttributes({ "preview.monitoring_installed_successfully": true });
        } catch (err) {
            // Currently failing to install the monitoring-satellite stack shouldn't cause the job to fail
            // so we only mark this single slice as failed.
            werft.failSlice(sliceID, err);
        }
    })();

    const installGitpod = (async () => {
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
            werft.log(installerSlices.INSTALL, "deploying using installer");
            await installer.install(installerSlices.INSTALL);
            exec(
                `werft log result -d "dev installation" -c github-check-preview-env url https://${deploymentConfig.domain}/workspaces`,
            );
        } catch (err) {
            werft.fail(installerSlices.INSTALL, err);
        }
    })();

    await Promise.all([installMonitoringSatellite, installGitpod]);
}
