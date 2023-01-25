import {GCLOUD_SERVICE_ACCOUNT_PATH, HARVESTER_KUBECONFIG_PATH, PREVIEW_K3S_KUBECONFIG_PATH} from "../jobs/build/const";
import {exec, execStream} from "../util/shell";
import {getGlobalWerftInstance} from "../util/werft";

/**
 * Remove all VM resources - Namespace+VM+Proxy svc on Harvester, LB+SVC on DEV
 */
export async function destroyPreview(options: { name: string }) {
    const werft = getGlobalWerftInstance();

    try {
        await execStream(`TF_VAR_preview_name=${options.name} \
                                    GOOGLE_APPLICATION_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                                    GOOGLE_BACKEND_CREDENTIALS=${GCLOUD_SERVICE_ACCOUNT_PATH} \
                                    leeway run dev/preview:delete-preview`,
            {slice: "Deleting VM."})
    } catch (err) {
        werft.currentPhaseSpan.setAttribute("preview.deleted_vm", false);
        werft.fail("Deleting VM.", new Error(`Failed deleting VM: ${err}`))
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
    const status = exec(`kubectl --kubeconfig ${HARVESTER_KUBECONFIG_PATH} -n ${namespace} get svc proxy`, {
        dontCheckRc: true,
        silent: true,
    });
    return status.code == 0;
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
        {dontCheckRc: true, silent: true},
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
 * Installs the preview environment's context
 * If it doesn't manage to do so before the timeout it will throw an Error
 */
export async function installPreviewContext(options: { name: string; slice: string }) {
    try {
        await execStream(
            `previewctl install-context --private-key-path=/workspace/.ssh/id_rsa_harvester_vm --gcp-service-account=${GCLOUD_SERVICE_ACCOUNT_PATH} --branch=${options.name} --timeout=10m`,
            {slice: options.slice},
        );

        exec(`mkdir -p $(dirname ${PREVIEW_K3S_KUBECONFIG_PATH})`)

        exec(
            `kubectl --context=${options.name} config view --minify --flatten > ${PREVIEW_K3S_KUBECONFIG_PATH}`,
            {dontCheckRc: true, slice: options.slice},
        )

        return;
    } catch (e) {
        throw new Error(
            `Wasn't able to copy out the kubeconfig before the timeout. `,
        );
    }
}

/**
 * Terminates all running kubectl proxies
 */
export function stopKubectlPortForwards() {
    exec(`sudo killall kubectl || true`);
}
