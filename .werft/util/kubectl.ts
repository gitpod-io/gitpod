import { ShellString } from 'shelljs';
import { exec, ExecOptions } from './shell';
import { sleep } from './util';
import { getGlobalWerftInstance, Werft } from './werft';


export const IS_PREVIEW_APP_LABEL: string = "isPreviewApp";

export const helmInstallName = "gitpod";

export function setKubectlContextNamespace(namespace: string, shellOpts: ExecOptions) {
    [
        `kubectl config current-context`,
        `kubectl config set-context --current --namespace=${namespace}`
    ].forEach(cmd => exec(cmd, shellOpts));
}

export async function wipePreviewEnvironmentAndNamespace(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance();

    // wipe preview envs built with installer
    await wipePreviewEnvironmentInstaller(namespace, shellOpts);

    // wipe preview envs previously built with helm
    await wipePreviewEnvironmentHelm(helmInstallName, namespace, shellOpts)

    deleteAllWorkspaces(namespace, shellOpts);

    await deleteAllUnnamespacedObjects(namespace, shellOpts);

    deleteNamespace(true, namespace, shellOpts);
    werft.done(shellOpts.slice)
}

export async function wipeAndRecreateNamespace(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    await wipePreviewEnvironmentAndNamespace(helmInstallName, namespace, shellOpts);

    createNamespace(namespace, shellOpts);
}

export async function wipePreviewEnvironmentHelm(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    // uninstall helm first so that:
    //  - ws-scaler can't create new ghosts in the meantime
    //  - ws-manager can't start new probes/workspaces
    uninstallHelm(helmInstallName, namespace, shellOpts)
}

async function wipePreviewEnvironmentInstaller(namespace: string, shellOpts: ExecOptions) {
    const slice = shellOpts.slice || "installer";
    const werft = getGlobalWerftInstance();

    const hasGitpodConfigmap = (exec(`kubectl -n ${namespace} get configmap gitpod-app`, { slice, dontCheckRc: true })).code === 0;
    if (hasGitpodConfigmap) {
        werft.log(slice, `${namespace} has Gitpod configmap, proceeding with removal`);
        const inWerftFolder = exec(`pwd`, { slice, dontCheckRc: true }).stdout.trim().endsWith(".werft");
        if (inWerftFolder) {
            // used in .werft/wipe-devstaging.yaml on preview environment clean-up
            exec(`./util/uninstall-gitpod.sh ${namespace}`, { slice });
        } else {
            // used in .werft/build.yaml on 'with-clean-slate-deployment=true'
            exec(`./.werft/util/uninstall-gitpod.sh ${namespace}`, { slice });
        }

    } else {
        werft.log(slice, `There is no Gitpod configmap, moving on`);
    }
}

function uninstallHelm(installationName: string, namespace: string, shellOpts: ExecOptions) {
    const installations = exec(`helm --namespace ${namespace} list -q`, { ...shellOpts, silent: true, dontCheckRc: true, async: false })
        .stdout
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);
    if (!installations.some(i => i === installationName)) {
        return;
    }

    exec(`helm --namespace ${namespace} delete ${installationName} --wait`, shellOpts);
}

// Delete pods for running workspaces, even if they are stuck in terminating because of the finalizer decorator
function deleteAllWorkspaces(namespace: string, shellOpts: ExecOptions) {
    const objs = exec(`kubectl get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`, { ...shellOpts, async: false })
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);

    objs.forEach(o => {
        try {
            // In most cases the calls below fails because the workspace is already gone. Ignore those cases, log others.
            exec(`kubectl patch pod --namespace ${namespace} ${o} -p '{"metadata":{"finalizers":null}}'`, { ...shellOpts });
            const result = exec(`kubectl delete pod --namespace ${namespace} ${o} --ignore-not-found=true --timeout=10s`, { ...shellOpts, async: false, dontCheckRc: true });
            if (result.code !== 0) {
                // We hit a timeout, and have no clue why. Manually re-trying has shown to consistenly being not helpful, either. Thus use THE FORCE.
                exec(`kubectl delete pod --namespace ${namespace} ${o} --ignore-not-found=true --force`, { ...shellOpts });
            }
        } catch (err) {
            const result = exec(`kubectl get pod --namespace ${namespace} ${o}`, { ...shellOpts, dontCheckRc: true, async: false });
            if (result.code === 0) {
                console.error(`unable to patch/delete ${o} but it's still on the dataplane`);
            }
        }
    });
}

// deleteAllUnnamespacedObjects deletes all unnamespaced objects for the given namespace
async function deleteAllUnnamespacedObjects(namespace: string, shellOpts: ExecOptions): Promise<void> {
    const werft = getGlobalWerftInstance()
    const slice = shellOpts.slice || "deleteobjs";

    const promisedDeletes: Promise<any>[] = [];
    for (const resType of ["clusterrole", "clusterrolebinding", "podsecuritypolicy"]) {
        werft.log(slice, `Searching and filtering ${resType}s...`);
        const objs = exec(`kubectl get ${resType} --no-headers -o=custom-columns=:metadata.name`, { ...shellOpts, slice, async: false })
            .split("\n")
            .map(o => o.trim())
            .filter(o => o.length > 0)
            .filter(o => o.startsWith(`${namespace}-ns-`)); // "{{ .Release.Namespace }}-ns-" is the prefix-pattern we use throughout our helm resources for un-namespaced resources

        werft.log(slice, `Deleting old ${resType}s...`);
        for (const obj of objs) {
            promisedDeletes.push(exec(`kubectl delete ${resType} ${obj}`, { ...shellOpts, slice, async: true }) as Promise<any>);
        }
    }
    await Promise.all(promisedDeletes);
}

export function createNamespace(namespace: string, shellOpts: ExecOptions) {
    const result = (exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true, async: false }));
    const exists = result.code === 0;
    if (exists) {
        return;
    }

    // (re-)create namespace
    [
        `kubectl create namespace ${namespace}`,
        `kubectl patch namespace ${namespace} --patch '{"metadata": {"labels": {"${IS_PREVIEW_APP_LABEL}": "true"}}}'`
    ].forEach((cmd) => exec(cmd, shellOpts));
};

export function listAllPreviewNamespaces(shellOpts: ExecOptions): string[] {
    return exec(`kubectl get namespaces -l ${IS_PREVIEW_APP_LABEL}=true -o=custom-columns=:metadata.name`, { ...shellOpts, silent: true, async: false })
        .stdout
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);
}

export function deleteNamespace(wait: boolean, namespace: string, shellOpts: ExecOptions) {
    // check if present
    const result = (exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true, async: false }));
    if (result.code !== 0) {
        return;
    }

    const cmd = `kubectl delete namespace ${namespace}`;
    exec(cmd, shellOpts);

    // wait until deletion was successful
    while (wait) {
        const result = (exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true, async: false }));
        wait = result.code === 0;
    }
}

export async function deleteNonNamespaceObjects(namespace: string, destname: string, shellOpts: ExecOptions) {
    exec(`/usr/local/bin/helm3 delete gitpod-${destname} || echo gitpod-${destname} was not installed yet`, { ...shellOpts });

    let objs = [];
    ["node-daemon", "cluster", "workspace", "ws-sync", "ws-manager-node", "ws-daemon", "registry-facade"].forEach(comp =>
        ["ClusterRole", "ClusterRoleBinding", "PodSecurityPolicy"].forEach(kind =>
            exec(`kubectl get ${kind} -l component=${comp} --no-headers -o=custom-columns=:metadata.name | grep ${namespace}-ns`, { ...shellOpts, dontCheckRc: true, async: false })
                .split("\n")
                .map(o => o.trim())
                .filter(o => o.length > 0)
                .forEach(obj => objs.push({ 'kind': kind, 'obj': obj }))
        )
    )

    const promisedDeletes: Promise<any>[] = [];
    objs.forEach(o => {
        promisedDeletes.push(exec(`kubectl delete ${o.kind} ${o.obj}`, { ...shellOpts, async: true }) as Promise<any>);
    });
    await Promise.all(promisedDeletes);
}

export interface PortRange {
    start: number;
    end: number;
}

export function findLastHostPort(namespace: string, name: string, shellOpts: ExecOptions): number {
    const portStr = exec(`kubectl get ds -n ${namespace} ${name} -o yaml | yq r - 'spec.template.spec.containers.*.ports.*.hostPort'`, { ...shellOpts, silent: true, async: false }).stdout
    return Number.parseInt(portStr)
}

export function findFreeHostPorts(ranges: PortRange[], shellOpts: ExecOptions): number[] {
    const werft = getGlobalWerftInstance()
    const hostPorts: number[] = exec(`kubectl get pods --all-namespaces -o yaml | yq r - 'items.*.spec.containers.*.ports.*.hostPort'`, { ...shellOpts, silent: true, async: false })
        .stdout
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => Number.parseInt(l));

    const nodePorts: number[] = exec(`kubectl get services --all-namespaces -o yaml | yq r - 'items.*.spec.ports.*.nodePort'`, { ...shellOpts, silent: true, async: false })
        .stdout
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => Number.parseInt(l));
    const alreadyReservedPorts: Set<number> = new Set();
    for (const port of hostPorts) {
        alreadyReservedPorts.add(port);
    }
    for (const port of nodePorts) {
        alreadyReservedPorts.add(port);
    }
    werft.log(shellOpts.slice, `already reserved ports: ${Array.from(alreadyReservedPorts.values()).map(p => "" + p).join(", ")}`);

    const results: number[] = [];
    for (const range of ranges) {
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
    return results;
}

export function waitForDeploymentToSucceed(name: string, namespace: string, type: string, shellOpts: ExecOptions) {
    exec(`kubectl rollout status ${type} ${name} -n ${namespace}`, shellOpts);
}

interface Pod {
    name: string
    owner: string
    phase: string
}

export async function waitUntilAllPodsAreReady(namespace: string, shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance();
    werft.log(shellOpts.slice, `Waiting until all pods in namespace ${namespace} are Running/Succeeded/Completed.`)
    for (let i = 0; i < 300; i++) {
        const pods: Pod[] = getPods(namespace)
        if (pods.length == 0) {
            werft.log(shellOpts.slice, `The namespace is empty or does not exist.`)
            await sleep(2 * 1000)
            continue
        }

        const unreadyPods = pods.filter(pod =>
            (pod.owner == "Job" && pod.phase != "Succeeded") ||
            (pod.owner != "Job" && pod.phase != "Running")
        )

        if (unreadyPods.length == 0) {
            werft.log(shellOpts.slice, `All pods are Running/Succeeded/Completed!`)
            return;
        }

        const list = unreadyPods.map(p => `${p.name}:${p.phase}`).join(", ")
        werft.log(shellOpts.slice, `Unready pods: ${list}`)

        await sleep(2 * 1000)
    }
    exec(`kubectl get pods -n ${namespace}`, { ...shellOpts, async: false })
    throw new Error(`Not all pods in namespace ${namespace} transitioned to 'Running' or 'Succeeded/Completed' during the expected time.`)
}

function getPods(namespace: string): Pod[] {
    const unsanitizedPods = exec(`kubectl get pods -n ${namespace}  -o=jsonpath='{range .items[*]}{@.metadata.name}:{@.metadata.ownerReferences[0].kind}:{@.status.phase};{end}'`, { silent: true, async: false });

    return unsanitizedPods
        .split(";")
        .map(l => l.trim())
        .filter(l => l)
        .map(s => { const i = s.split(":"); return { name: i[0], owner: i[1], phase: i[2] } })
}

export async function waitForApiserver(shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance();
    for (let i = 0; i < 300; i++) {
        werft.log(shellOpts.slice, 'Checking that k3s apiserver is ready...')
        const result = exec(`kubectl get --raw='/readyz?verbose'`, { ...shellOpts, dontCheckRc: true, async: false });
        if (result.code == 0) {
            werft.log(shellOpts.slice, 'k3s apiserver is ready')
            return;
        }
        await sleep(2 * 1000)
    }
    throw new Error(`The Apiserver did not become ready during the expected time.`)
}