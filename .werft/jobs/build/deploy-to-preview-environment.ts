import * as fs from "fs";
import { exec } from "../../util/shell";
import { MonitoringSatelliteInstaller } from "../../observability/monitoring-satellite";
import { Werft } from "../../util/werft";
import { Analytics, JobConfig } from "./job-config";
import * as VM from "../../vm/vm";
import { Installer } from "./installer/installer";
import { ChildProcess, spawn } from 'child_process';

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
    DEDICATED_PRESEED: "Preseed for Dedicated",
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
    const { version, cleanSlateDeployment, withObservability, installEELicense, workspaceFeatureFlags, useWsManagerMk2 } = jobConfig;

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
            previewName: exec(`previewctl get name --branch=${jobConfig.repository.branch}`).stdout.trim(),
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
            withDedicatedEmulation: jobConfig.withDedicatedEmulation,
            useWsManagerMk2: useWsManagerMk2,
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

        if (jobConfig.withDedicatedEmulation) {
            // After the installation is done, and everything is running, we need to prepare first-time access for the admin-user
            let portForwardProcess: ChildProcess | undefined;
            try {
                werft.log(installerSlices.DEDICATED_PRESEED, "preseed for dedicated");
                portForwardProcess = spawn("kubectl", ["port-forward", "deployment/server", "9000", "&"], {
                    shell: true,
                    detached: true,
                    stdio: "overlapped",
                });
                await new Promise(resolve => portForwardProcess.stdout.on('data', resolve));    // wait until process is running

                const adminLoginOts = exec(`curl -X POST localhost:9000/admin-user/login-token/create`, { silent: true }).stdout.trim();
                exec(
                    `werft log result "admin login OTS token" ${adminLoginOts}`,
                );
                exec(
                    `werft log result -d "admin-user login link" url https://${deploymentConfig.domain}/api/login/ots/admin-user/${adminLoginOts}`,
                );
                werft.log(installerSlices.DEDICATED_PRESEED, "done preseeding for dedicated.");
            } catch (err) {
                werft.fail(installerSlices.DEDICATED_PRESEED, err);
            } finally {
                if (portForwardProcess) {
                    portForwardProcess.kill("SIGINT");
                }
            }
        }
    })();

    await Promise.all([installMonitoringSatellite, installGitpod]);
}
