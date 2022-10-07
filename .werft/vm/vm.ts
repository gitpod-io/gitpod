import {
    CORE_DEV_KUBECONFIG_PATH,
    GCLOUD_SERVICE_ACCOUNT_PATH,
    HARVESTER_KUBECONFIG_PATH,
    PREVIEW_K3S_KUBECONFIG_PATH
} from "../jobs/build/const";
import { exec } from "../util/shell";
import { getGlobalWerftInstance } from "../util/werft";

import * as shell from "shelljs";

/**
 * Remove all VM resources - Namespace+VM+Proxy svc on Harvester, LB+SVC on DEV
 */
export function deleteVM(options: { name: string }) {
    const werft = getGlobalWerftInstance();

    try {
        exec(`DESTROY=true \
                                    GOOGLE_BACKEND_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                                    TF_VAR_dev_kube_path=${CORE_DEV_KUBECONFIG_PATH} \
                                    TF_VAR_harvester_kube_path=${HARVESTER_KUBECONFIG_PATH} \
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

/**
 * Install Rook/Ceph storage that supports CSI snapshot
 */
export function installRookCeph(options: { kubeconfig: string }) {
    exec(`kubectl --kubeconfig ${options.kubeconfig} apply -f .werft/vm/manifests/rook-ceph/crds.yaml --server-side --force-conflicts`
    );
    exec(`kubectl --kubeconfig ${options.kubeconfig} wait --for condition=established --timeout=120s crd/cephclusters.ceph.rook.io`
    );
    exec(`kubectl --kubeconfig ${options.kubeconfig} apply -f .werft/vm/manifests/rook-ceph/common.yaml -f .werft/vm/manifests/rook-ceph/operator.yaml`
    );
    exec(`kubectl --kubeconfig ${options.kubeconfig} apply -f .werft/vm/manifests/rook-ceph/cluster-test.yaml`);
    exec(`kubectl --kubeconfig ${options.kubeconfig} apply -f .werft/vm/manifests/rook-ceph/storageclass-test.yaml`);
    exec(`kubectl --kubeconfig ${options.kubeconfig} apply -f .werft/vm/manifests/rook-ceph/snapshotclass.yaml`);
}

/**
 * Install Fluent-Bit sending logs to GCP
 */
export function installFluentBit(options: { namespace: string; kubeconfig: string; slice: string }) {
    exec(
        `kubectl --kubeconfig ${options.kubeconfig} create secret generic fluent-bit-external --save-config --dry-run=client --from-file=credentials.json=/mnt/fluent-bit-external/credentials.json -o yaml | kubectl --kubeconfig ${options.kubeconfig} apply -n ${options.namespace} -f -`,
        { slice: options.slice, dontCheckRc: true },
    );
    exec(`helm3 --kubeconfig ${options.kubeconfig} repo add fluent https://fluent.github.io/helm-charts`, {
        slice: options.slice,
        dontCheckRc: true,
    });
    exec(`helm3 --kubeconfig ${options.kubeconfig} repo update`, { slice: options.slice, dontCheckRc: true });
    exec(
        `helm3 --kubeconfig ${options.kubeconfig} upgrade --install fluent-bit fluent/fluent-bit -n ${options.namespace} -f .werft/vm/charts/fluentbit/values.yaml`,
        { slice: options.slice, dontCheckRc: true },
    );
}
