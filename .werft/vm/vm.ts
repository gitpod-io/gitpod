import {
    GCLOUD_SERVICE_ACCOUNT_PATH,
    GLOBAL_KUBECONFIG_PATH,
    HARVESTER_KUBECONFIG_PATH,
    PREVIEW_K3S_KUBECONFIG_PATH
} from "../jobs/build/const";
import {exec, execStream} from "../util/shell";
import { getGlobalWerftInstance } from "../util/werft";

import * as shell from "shelljs";

/**
 * Remove all VM resources - Namespace+VM+Proxy svc on Harvester, LB+SVC on DEV
 */
export async function deleteVM(options: { name: string }) {
    const werft = getGlobalWerftInstance();

    try {
        await execStream(`DESTROY=true \
                                    GOOGLE_APPLICATION_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                                    GOOGLE_BACKEND_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                                    TF_VAR_kubeconfig_path=${GLOBAL_KUBECONFIG_PATH} \
                                    TF_VAR_preview_name=${options.name} \
                                    ./dev/preview/workflow/preview/deploy-harvester.sh`,
            {slice: "Deleting VM."})
    } catch (err) {
        werft.currentPhaseSpan.setAttribute("preview.deleted_vm", false);
        werft.fail("Deleting VM.", new Error(`Failed creating VM: ${err}`))
        return;
    }

    werft.currentPhaseSpan.setAttribute("preview.deleted_vm", true);
}

/**
 * Check if a VM with the given name already exists.
 * @returns true if the VM already exists
 */
export function vmExists(options: { name: string }) {
    const namespace = `preview-${options.name}`;
    const status = exec(`kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} -n ${namespace} get vmi ${options.name}`, {
        dontCheckRc: true,
        silent: true,
    });
    return status.code == 0;
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

export class KubectlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "KubectlError";
    }
}

export function get(options: { name: string }): shell.ShellString {
    const namespace = `preview-${options.name}`;
    const vmErrNotFound = `Error from server (NotFound): virtualmachineinstances.kubevirt.io "${this.name}" not found`;
    const namespaceErrNotFound = `Error from server (NotFound): namespaces "${namespace}" not found`;
    const vm = exec(`kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} -n ${namespace} get vmi ${options.name}`, {
        dontCheckRc: true,
        silent: true,
    });

    if (vm.code != 0) {
        switch (vm.stderr) {
            case vmErrNotFound:
            case namespaceErrNotFound:
                throw new NotFoundError("The VM or Namespace doesn't exist");
            default:
                throw new KubectlError(vm.stderr);
        }
    }

    return vm;
}

/**
 * Wait until the VM Instance reaches the Running status.
 * If the VM Instance doesn't reach Running before the timeoutMS it will throw an Error.
 */
export function waitForVMReadiness(options: { name: string; timeoutSeconds: number; slice: string }) {
    const werft = getGlobalWerftInstance();
    const namespace = `preview-${options.name}`;

    const startTime = Date.now();
    const ready = exec(
        `kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} -n ${namespace} wait --for=condition=ready --timeout=${options.timeoutSeconds}s pod -l kubevirt.io=virt-launcher -l harvesterhci.io/vmName=${options.name}`,
        { dontCheckRc: true, silent: true },
    );

    if (ready.code == 0) {
        werft.log(options.slice, `VM is ready after ${(Date.now() - startTime) / 1000} seconds`);
        return;
    }

    werft.log(
        options.slice,
        `Timeout while waiting for VM to get ready. Timeout: ${options.timeoutSeconds}. Stderr: ${ready.stderr}. Stdout: ${ready.stdout}`,
    );
    throw new Error("VM didn't reach 'Ready' status before the timeout.");
}

/**
 * Copies the k3s kubeconfig out of the VM and places it at `path`
 * If it doesn't manage to do so before the timeout it will throw an Error
 */
export function copyk3sKubeconfigShell(options: { name: string; timeoutMS: number; slice: string }) {
    const werft = getGlobalWerftInstance();
    const startTime = Date.now();
    while (true) {
        const status = exec(
            `VM_NAME=${options.name} \
                      K3S_KUBECONFIG_PATH=${PREVIEW_K3S_KUBECONFIG_PATH} \
                      GCLOUD_SERVICE_ACCOUNT_PATH=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                      ./dev/preview/install-k3s-kubeconfig.sh`,
            { dontCheckRc: true, slice: options.slice },
        );

        if (status.code == 0) {
            return;
        }

        const elapsedTimeMs = Date.now() - startTime;
        if (elapsedTimeMs > options.timeoutMS) {
            throw new Error(
                `Wasn't able to copy out the kubeconfig before the timeout. Exit code ${status.code}. Stderr: ${status.stderr}. Stdout: ${status.stdout}`,
            );
        }

        werft.log(options.slice, `Wasn't able to copy out kubeconfig yet. Sleeping 10 seconds`);
        exec("sleep 10", { silent: true, slice: options.slice });
    }
}

/**
 * Terminates all running kubectl proxies
 */
export function stopKubectlPortForwards() {
    exec(`sudo killall kubectl || true`);
}
