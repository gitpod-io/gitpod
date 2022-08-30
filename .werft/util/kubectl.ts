import { exec, ExecOptions, ExecResult } from "./shell";
import { sleep } from "./util";
import { getGlobalWerftInstance } from "./werft";

export const IS_PREVIEW_APP_LABEL: string = "isPreviewApp";

export function setKubectlContextNamespace(namespace: string, shellOpts: ExecOptions) {
    [`kubectl config current-context`, `kubectl config set-context --current --namespace=${namespace}`].forEach((cmd) =>
        exec(cmd, shellOpts),
    );
}

export async function wipePreviewEnvironmentAndNamespace(
    namespace: string,
    kubeconfig: string,
    shellOpts: ExecOptions,
) {
    const werft = getGlobalWerftInstance();

    // wipe preview envs built with installer
    await wipePreviewEnvironmentInstaller(namespace, kubeconfig, shellOpts);

    deleteAllWorkspaces(namespace, kubeconfig, shellOpts);

    await deleteAllUnnamespacedObjects(namespace, kubeconfig, shellOpts);

    deleteNamespace(true, namespace, kubeconfig, shellOpts);
    werft.done(shellOpts.slice);
}

export async function wipeAndRecreateNamespace(
    namespace: string,
    kubeconfig: string,
    shellOpts: ExecOptions,
) {
    await wipePreviewEnvironmentAndNamespace(namespace, kubeconfig, shellOpts);

    createNamespace(namespace, kubeconfig, shellOpts);
}

async function wipePreviewEnvironmentInstaller(namespace: string, kubeconfig: string, shellOpts: ExecOptions) {
    const slice = shellOpts.slice || "installer";
    const werft = getGlobalWerftInstance();

    const hasGitpodConfigmap =
        exec(`kubectl --kubeconfig ${kubeconfig} -n ${namespace} get configmap gitpod-app`, {
            slice,
            dontCheckRc: true,
        }).code === 0;
    if (hasGitpodConfigmap) {
        werft.log(slice, `${namespace} has Gitpod configmap, proceeding with removal`);
        exec(`./util/uninstall-gitpod.sh ${namespace} ${kubeconfig}`, { slice });
    } else {
        werft.log(slice, `There is no Gitpod configmap, moving on`);
    }
}

// Delete pods for running workspaces, even if they are stuck in terminating because of the finalizer decorator
function deleteAllWorkspaces(namespace: string, kubecofig: string, shellOpts: ExecOptions) {
    const objs = exec(
        `kubectl --kubeconfig ${kubecofig} get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`,
        { ...shellOpts, async: false },
    )
        .split("\n")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

    objs.forEach((o) => {
        try {
            // In most cases the calls below fails because the workspace is already gone. Ignore those cases, log others.
            exec(
                `kubectl --kubeconfig ${kubecofig} patch pod --namespace ${namespace} ${o} -p '{"metadata":{"finalizers":null}}'`,
                { ...shellOpts },
            );
            const result = exec(
                `kubectl --kubeconfig ${kubecofig} delete pod --namespace ${namespace} ${o} --ignore-not-found=true --timeout=10s`,
                { ...shellOpts, async: false, dontCheckRc: true },
            );
            if (result.code !== 0) {
                // We hit a timeout, and have no clue why. Manually re-trying has shown to consistenly being not helpful, either. Thus use THE FORCE.
                exec(
                    `kubectl --kubeconfig ${kubecofig} delete pod --namespace ${namespace} ${o} --ignore-not-found=true --force`,
                    { ...shellOpts },
                );
            }
        } catch (err) {
            const result = exec(`kubectl --kubeconfig ${kubecofig} get pod --namespace ${namespace} ${o}`, {
                ...shellOpts,
                dontCheckRc: true,
                async: false,
            });
            if (result.code === 0) {
                console.error(`unable to patch/delete ${o} but it's still on the dataplane`);
            }
        }
    });
}

// deleteAllUnnamespacedObjects deletes all unnamespaced objects for the given namespace
async function deleteAllUnnamespacedObjects(
    namespace: string,
    kubeconfig: string,
    shellOpts: ExecOptions,
): Promise<void> {
    const werft = getGlobalWerftInstance();
    const slice = shellOpts.slice || "deleteobjs";

    const promisedDeletes: Promise<any>[] = [];
    for (const resType of ["clusterrole", "clusterrolebinding", "podsecuritypolicy"]) {
        werft.log(slice, `Searching and filtering ${resType}s...`);
        const objs = exec(
            `kubectl --kubeconfig ${kubeconfig} get ${resType} --no-headers -o=custom-columns=:metadata.name`,
            { ...shellOpts, slice, async: false },
        )
            .split("\n")
            .map((o) => o.trim())
            .filter((o) => o.length > 0)
            .filter((o) => o.startsWith(`${namespace}-ns-`)); // "{{ .Release.Namespace }}-ns-" is the prefix-pattern we use throughout our helm resources for un-namespaced resources

        werft.log(slice, `Deleting old ${resType}s...`);
        for (const obj of objs) {
            promisedDeletes.push(
                exec(`kubectl --kubeconfig ${kubeconfig} delete ${resType} ${obj}`, {
                    ...shellOpts,
                    slice,
                    async: true,
                }) as Promise<any>,
            );
        }
    }
    await Promise.all(promisedDeletes);
}

export function createNamespace(namespace: string, kubeconfig: string, shellOpts: ExecOptions) {
    const result = exec(`kubectl --kubeconfig ${kubeconfig} get namespace ${namespace}`, {
        ...shellOpts,
        dontCheckRc: true,
        async: false,
    });
    const exists = result.code === 0;
    if (exists) {
        return;
    }

    // (re-)create namespace
    [
        `kubectl --kubeconfig ${kubeconfig} create namespace ${namespace}`,
        `kubectl --kubeconfig ${kubeconfig} patch namespace ${namespace} --patch '{"metadata": {"labels": {"${IS_PREVIEW_APP_LABEL}": "true"}}}'`,
    ].forEach((cmd) => exec(cmd, shellOpts));
}

export function listAllPreviewNamespaces(kubeconfig: string, shellOpts: ExecOptions): string[] {
    return exec(
        `kubectl --kubeconfig ${kubeconfig} get namespaces -l ${IS_PREVIEW_APP_LABEL}=true -o=custom-columns=:metadata.name`,
        { ...shellOpts, silent: true, async: false },
    )
        .stdout.split("\n")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
}

export function deleteNamespace(wait: boolean, namespace: string, kubeconfig: string, shellOpts: ExecOptions) {
    // check if present
    const result = exec(`kubectl --kubeconfig ${kubeconfig} get namespace ${namespace}`, {
        ...shellOpts,
        dontCheckRc: true,
        async: false,
    });
    if (result.code !== 0) {
        return;
    }

    const cmd = `kubectl --kubeconfig ${kubeconfig} delete namespace ${namespace}`;
    exec(cmd, shellOpts);

    // wait until deletion was successful
    while (wait) {
        const result = exec(`kubectl --kubeconfig ${kubeconfig} get namespace ${namespace}`, {
            ...shellOpts,
            dontCheckRc: true,
            async: false,
        });
        wait = result.code === 0;
    }
}

export interface PortRange {
    start: number;
    end: number;
}

export function findLastHostPort(namespace: string, name: string, kubeconfig: string, shellOpts: ExecOptions): number {
    const portStr = exec(
        `kubectl --kubeconfig ${kubeconfig} get ds -n ${namespace} ${name} -o yaml | yq r - 'spec.template.spec.containers.*.ports.*.hostPort'`,
        { ...shellOpts, silent: true, async: false },
    ).stdout;
    return Number.parseInt(portStr);
}

export async function findFreeHostPorts(
    ranges: PortRange[],
    kubeconfig: string,
    shellOpts: ExecOptions,
): Promise<number[]> {
    const werft = getGlobalWerftInstance();
    var hostPorts: Array<number> = [];
    var nodePorts: Array<number> = [];

    const hostPortsPromise = exec(
        `kubectl --kubeconfig ${kubeconfig} get pods --all-namespaces -o yaml | yq r - 'items.*.spec.containers.*.ports.*.hostPort | grep -v null | sort | uniq'`,
        { ...shellOpts, silent: true, async: true },
    ) as Promise<ExecResult>;
    const nodePortsPromise = exec(
        `kubectl --kubeconfig ${kubeconfig} get services --all-namespaces -o yaml | yq r - 'items.*.spec.ports.*.nodePort | grep -v null | sort | uniq'`,
        { ...shellOpts, silent: true, async: true },
    ) as Promise<ExecResult>;

    hostPortsPromise.then(
        (res) =>
            (hostPorts = res.stdout
                .split("\n")
                .map((line) => line.trim())
                .map((line) => Number.parseInt(line))),
    );
    nodePortsPromise.then(
        (res) =>
            (nodePorts = res.stdout
                .split("\n")
                .map((line) => line.trim())
                .map((line) => Number.parseInt(line))),
    );

    await Promise.all([hostPortsPromise, nodePortsPromise]);

    const alreadyReservedPorts: Set<number> = new Set([].concat(hostPorts, nodePorts));

    werft.log(
        shellOpts.slice,
        `already reserved ports: ${Array.from(alreadyReservedPorts.values())
            .map((p) => "" + p)
            .join(", ")}`,
    );

    const results: number[] = [];
    for (const range of ranges) {
        if (results.length > 4) {
            break;
        }

        const r = range.end - range.start;
        while (true) {
            const hostPort = range.start + Math.floor(Math.random() * r);
            if (alreadyReservedPorts.has(hostPort)) {
                continue;
            }

            // found one, now find the others
            results.push(hostPort);
            alreadyReservedPorts.add(hostPort);
            break;
        }
    }

    return new Promise((resolve) => {
        resolve(results);
    });
}

export function waitForDeploymentToSucceed(
    name: string,
    namespace: string,
    type: string,
    kubeconfig: string,
    shellOpts: ExecOptions,
) {
    exec(`kubectl --kubeconfig ${kubeconfig} rollout status ${type} ${name} -n ${namespace}`, shellOpts);
}

interface Pod {
    name: string;
    owner: string;
    phase: string;
}

export async function waitUntilAllPodsAreReady(namespace: string, kubeconfig: string, shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance();
    werft.log(shellOpts.slice, `Waiting until all pods in namespace ${namespace} are Running/Succeeded/Completed.`);
    for (let i = 0; i < 200; i++) {
        let pods: Pod[];
        try {
            pods = getPods(namespace, kubeconfig);
        } catch (err) {
            werft.log(shellOpts.slice, err);
            continue;
        }
        if (pods.length == 0) {
            werft.log(shellOpts.slice, `The namespace is empty or does not exist.`);
            await sleep(3 * 1000);
            continue;
        }

        const unreadyPods = pods.filter(
            (pod) => (pod.owner == "Job" && pod.phase != "Succeeded") || (pod.owner != "Job" && pod.phase != "Running"),
        );

        if (unreadyPods.length == 0) {
            werft.log(shellOpts.slice, `All pods are Running/Succeeded/Completed!`);
            return;
        }

        const list = unreadyPods.map((p) => `${p.name}:${p.phase}`).join(", ");
        werft.log(shellOpts.slice, `Unready pods: ${list}`);

        await sleep(3 * 1000);
    }
    exec(`kubectl --kubeconfig ${kubeconfig} describe pods -n ${namespace}`, { ...shellOpts, async: false });
    throw new Error(
        `Not all pods in namespace ${namespace} transitioned to 'Running' or 'Succeeded/Completed' during the expected time.`,
    );
}

function getPods(namespace: string, kubeconfig: string): Pod[] {
    const cmd = `kubectl --kubeconfig ${kubeconfig} get pods -n ${namespace} -l 'component!=workspace'  -o=jsonpath='{range .items[*]}{@.metadata.name}:{@.metadata.ownerReferences[0].kind}:{@.status.phase};{end}'`;
    const unsanitizedPods = exec(cmd, { silent: true, async: false, dontCheckRc: true });
    if (unsanitizedPods.code != 0) {
        throw new Error(
            `"${cmd}" failed with code ${unsanitizedPods.code}; stdout: ${unsanitizedPods.stdout}; stderr: ${unsanitizedPods.stderr}`,
        );
    }

    return unsanitizedPods
        .split(";")
        .map((l) => l.trim())
        .filter((l) => l)
        .map((s) => {
            const i = s.split(":");
            return { name: i[0], owner: i[1], phase: i[2] };
        });
}

export async function waitForApiserver(kubeconfig: string, shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance();
    for (let i = 0; i < 300; i++) {
        werft.log(shellOpts.slice, "Checking that k3s apiserver is ready...");
        const result = exec(`kubectl --kubeconfig ${kubeconfig} get --raw='/readyz?verbose'`, {
            ...shellOpts,
            dontCheckRc: true,
            async: false,
        });
        if (result.code == 0) {
            werft.log(shellOpts.slice, "k3s apiserver is ready");
            return;
        }
        await sleep(2 * 1000);
    }
    throw new Error(`The Apiserver did not become ready during the expected time.`);
}
