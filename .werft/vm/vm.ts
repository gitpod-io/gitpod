import { HARVESTER_KUBECONFIG_PATH, PREVIEW_K3S_KUBECONFIG_PATH } from "../jobs/build/const";
import { exec } from "../util/shell";
import { getGlobalWerftInstance } from "../util/werft";

import * as Manifests from "./manifests";
import * as shell from "shelljs";

/**
 * Convenience function to kubectl apply a manifest from stdin.
 */
function kubectlApplyManifest(manifest: string, options?: { validate?: boolean }) {
    exec(`
        cat <<EOF | kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} apply --validate=${!!options?.validate} -f -
${manifest}
EOF
    `);
}

/**
 * Convenience function to kubectl delete a manifest from stdin.
 */
function kubectlDeleteManifest(manifest: string) {
    exec(`
        cat <<EOF | kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} delete --ignore-not-found=true -f -
${manifest}
EOF
    `);
}

/**
 * Start a VM
 * Does not wait for the VM to be ready.
 */
export function startVM(options: { name: string, cpu: number, memory: number }) {
    const namespace = `preview-${options.name}`;
    const userDataSecretName = `userdata-${options.name}`;

    kubectlApplyManifest(
        Manifests.NamespaceManifest({
            namespace,
        }),
    );

    kubectlApplyManifest(
        Manifests.UserDataSecretManifest({
            vmName: options.name,
            namespace,
            secretName: userDataSecretName,
        }),
    );

    kubectlApplyManifest(
        Manifests.VirtualMachineManifest({
            namespace,
            vmName: options.name,
            claimName: `${options.name}-${Date.now()}`,
            storageClaimName: `${options.name}-storage-${Date.now()}`,
            userDataSecretName,
            cpu: options.cpu,
            memory: options.memory
        }),
        { validate: false },
    );

    kubectlApplyManifest(
        Manifests.ServiceManifest({
            vmName: options.name,
            namespace,
        }),
    );
}

/**
 * Remove a VM with its Namespace
 */
export function deleteVM(options: { name: string }) {
    const namespace = `preview-${options.name}`;
    const userDataSecretName = `userdata-${options.name}`;

    kubectlDeleteManifest(
        Manifests.ServiceManifest({
            vmName: options.name,
            namespace,
        }),
    );

    kubectlDeleteManifest(
        Manifests.UserDataSecretManifest({
            vmName: options.name,
            namespace,
            secretName: userDataSecretName,
        }),
    );

    kubectlDeleteManifest(
        Manifests.VirtualMachineManifest({
            namespace,
            vmName: options.name,
            claimName: `${options.name}-${Date.now()}`,
            storageClaimName: `${options.name}-storage-${Date.now()}`,
            userDataSecretName,
            cpu: 0,
            memory: 0,
        }),
    );

    kubectlDeleteManifest(
        Manifests.NamespaceManifest({
            namespace,
        }),
    );
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
            `./dev/preview/install-k3s-kubeconfig.sh`,
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

        werft.log(options.slice, `Wasn't able to copy out kubeconfig yet. Sleeping 5 seconds`);
        exec("sleep 5", { silent: true, slice: options.slice });
    }
}

/**
 * Copies the k3s kubeconfig out of the VM and places it at `path`
 * If it doesn't manage to do so before the timeout it will throw an Error
 */
export function copyk3sKubeconfig(options: { name: string; timeoutMS: number; slice: string }) {
    const werft = getGlobalWerftInstance();
    const startTime = Date.now();
    while (true) {
        const status = exec(
            `ssh -i /workspace/.ssh/id_rsa_harvester_vm ubuntu@127.0.0.1 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no 'sudo cat /etc/rancher/k3s/k3s.yaml' > ${PREVIEW_K3S_KUBECONFIG_PATH}`,
            { silent: true, dontCheckRc: true, slice: options.slice },
        );

        if (status.code == 0) {
            exec(
                `kubectl --kubeconfig ${PREVIEW_K3S_KUBECONFIG_PATH} config set clusters.default.server https://${options.name}.kube.gitpod-dev.com:6443`,
                { silent: true, slice: options.slice },
            );
            return;
        }

        const elapsedTimeMs = Date.now() - startTime;
        if (elapsedTimeMs > options.timeoutMS) {
            throw new Error(
                `Wasn't able to copy out the kubeconfig before the timeout. Exit code ${status.code}. Stderr: ${status.stderr}. Stdout: ${status.stdout}`,
            );
        }

        werft.log(options.slice, `Wasn't able to copy out kubeconfig yet. Sleeping 5 seconds`);
        exec("sleep 5", { silent: true, slice: options.slice });
    }
}

/**
 * Proxy 127.0.0.1:22 to :22 in the VM through the k8s service
 */
export function startSSHProxy(options: { name: string; slice: string }) {
    const namespace = `preview-${options.name}`;
    exec(`sudo kubectl --kubeconfig=${HARVESTER_KUBECONFIG_PATH} -n ${namespace} port-forward service/proxy 22:2200`, {
        async: true,
        silent: true,
        slice: options.slice,
        dontCheckRc: true,
    });
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
