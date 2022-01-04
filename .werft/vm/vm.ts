import { exec } from '../util/shell';
import { getGlobalWerftInstance } from '../util/werft';

import * as Manifests from './manifests'

const KUBECONFIG_PATH = '/mnt/secrets/harvester-kubeconfig/harvester-kubeconfig.yml'

/**
 * Convenience function to kubectl apply a manifest from stdin.
 */
function kubectlApplyManifest(manifest: string, options?: { validate?: boolean }) {
    exec(`
        cat <<EOF | kubectl --kubeconfig ${KUBECONFIG_PATH} apply --validate=${!!options?.validate} -f -
${manifest}
EOF
    `)
}

/**
 * Start a VM
 * Does not wait for the VM to be ready.
 */
export function startVM(options: { name: string }) {
    const namespace = `preview-${options.name}`
    const userDataSecretName = `userdata-${options.name}`

    kubectlApplyManifest(
        Manifests.NamespaceManifest({
            namespace
        })
    )

    kubectlApplyManifest(
        Manifests.UserDataSecretManifest({
            vmName: options.name,
            namespace,
            secretName: userDataSecretName,
        })
    )

    kubectlApplyManifest(
        Manifests.VirtualMachineManifest({
            namespace,
            vmName: options.name,
            claimName: `${options.name}-${Date.now()}`,
            userDataSecretName
        }),
        { validate: false }
    )

    kubectlApplyManifest(
        Manifests.ServiceManifest({
            vmName: options.name,
            namespace
        })
    )
}

/**
 * Check if a VM with the given name already exists.
 * @returns true if the VM already exists
 */
export function vmExists(options: { name: string }) {
    const namespace = `preview-${options.name}`
    const status = exec(`kubectl --kubeconfig ${KUBECONFIG_PATH} -n ${namespace} get vmi ${options.name}`, { dontCheckRc: true, silent: true })
    return status.code == 0
}

/**
 * Wait until the VM Instance reaches the Running status.
 * If the VM Instance doesn't reach Running before the timeoutMS it will throw an Error.
 */
export function waitForVM(options: { name: string, timeoutMS: number, slice: string }) {
    const werft = getGlobalWerftInstance()
    const namespace = `preview-${options.name}`
    const startTime = Date.now()
    while (true) {

        const status = exec(`kubectl --kubeconfig ${KUBECONFIG_PATH} -n ${namespace} get vmi ${options.name} -o jsonpath="{.status.phase}"`, { silent: true, slice: options.slice }).stdout.trim()

        if (status == "Running") {
            return
        }

        const elapsedTimeMs = Date.now() - startTime
        if (elapsedTimeMs > options.timeoutMS) {
            throw new Error("VM didn reach Running status before the timeout")
        }

        werft.log(options.slice, `VM is not yet running. Current status is ${status}. Sleeping 5 seconds`)
        exec('sleep 5', { silent: true, slice: options.slice })
    }
}

/**
 * Copies the k3s kubeconfig out of the VM and places it at `path`
 * If it doesn't manage to do so before the timeout it will throw an Error
 */
export function copyk3sKubeconfig(options: { path: string, timeoutMS: number, slice: string }) {
    const werft = getGlobalWerftInstance()
    const startTime = Date.now()
    while (true) {

        const status = exec(`ssh -i /workspace/.ssh/id_rsa_harvester_vm ubuntu@127.0.0.1 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no 'sudo cat /etc/rancher/k3s/k3s.yaml' > ${options.path}`, { silent: true, dontCheckRc: true, slice: options.slice })

        if (status.code == 0) {
            return
        }

        const elapsedTimeMs = Date.now() - startTime
        if (elapsedTimeMs > options.timeoutMS) {
            throw new Error(`Wasn't able to copy out the kubeconfig before the timeout. Exit code ${status.code}. Stderr: ${status.stderr}. Stdout: ${status.stdout}`)
        }

        werft.log(options.slice, `Wasn't able to copy out kubeconfig yet. Sleeping 5 seconds`)
        exec('sleep 5', { silent: true, slice: options.slice })
    }
}

/**
 * Proxy 127.0.0.1:22 to :22 in the VM through the k8s service
 */
export function startSSHProxy(options: { name: string, slice: string }) {
    const namespace = `preview-${options.name}`
    exec(`sudo kubectl --kubeconfig=${KUBECONFIG_PATH} -n ${namespace} port-forward service/proxy 22:22`, { async: true, silent: true, slice: options.slice })
}

/**
 * Proxy 127.0.0.1:6443 to :6443 in the VM through the k8s service
 */
export function startKubeAPIProxy(options: { name: string, slice: string }) {
    const namespace = `preview-${options.name}`
    exec(`sudo kubectl --kubeconfig=${KUBECONFIG_PATH} -n ${namespace} port-forward service/proxy 6443:6443`, { async: true, silent: true, slice: options.slice })
}

/**
 * Terminates all running kubectl proxies
 */
export function stopKubectlPortForwards() {
    exec(`sudo killall kubectl || true`)
}
