import { ShellString } from 'shelljs';
import { exec, ExecOptions } from './shell';
import { getGlobalWerftInstance } from './werft';


export const IS_PREVIEW_APP_LABEL: string = "isPreviewApp";

export function setKubectlContextNamespace(pathToKubeConfig, namespace, shellOpts) {
    [
        `export KUBECONFIG=${pathToKubeConfig} && kubectl config current-context`,
        `export KUBECONFIG=${pathToKubeConfig} && kubectl config set-context --current --namespace=${namespace}`
    ].forEach(cmd => exec(cmd, shellOpts));
}

export async function wipeAndRecreateNamespace(pathToKubeConfig: string, helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    await wipePreviewEnvironment(pathToKubeConfig, helmInstallName, namespace, shellOpts);

    createNamespace(pathToKubeConfig, namespace, shellOpts);
}

export async function wipePreviewEnvironment(pathToKubeConfig: string, helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    // uninstall helm first so that:
    //  - ws-scaler can't create new ghosts in the meantime
    //  - ws-manager can't start new probes/workspaces
    uninstallHelm(pathToKubeConfig, helmInstallName, namespace, shellOpts)

    deleteAllWorkspaces(pathToKubeConfig, namespace, shellOpts);
    await deleteAllUnnamespacedObjects(pathToKubeConfig, namespace, shellOpts);

    deleteNamespace(pathToKubeConfig, true, namespace, shellOpts);
}

function uninstallHelm(pathToKubeConfig: string, installationName: string, namespace: string, shellOpts: ExecOptions) {
    const installations = exec(`export KUBECONFIG=${pathToKubeConfig} && helm --namespace ${namespace} list -q`, { silent: true, dontCheckRc: true })
        .stdout
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);
    if (!installations.some(i => i === installationName)) {
        return;
    }

    exec(`export KUBECONFIG=${pathToKubeConfig} && helm --namespace ${namespace} delete ${installationName} --wait`, shellOpts);
}

function deleteAllWorkspaces(pathToKubeConfig: string, namespace: string, shellOpts: ExecOptions) {
    const objs = exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`)
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);

    objs.forEach(o => {
        try {
            // In most cases the calls below fails because the workspace is already gone. Ignore those cases, log others.
            exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl patch pod --namespace ${namespace} ${o} -p '{"metadata":{"finalizers":null}}'`, { ...shellOpts });
            const result = exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl delete pod --namespace ${namespace} ${o} --ignore-not-found=true --timeout=10s`, { ...shellOpts, async: false, dontCheckRc: true });
            if (result.code !== 0) {
                // We hit a timeout, and have no clue why. Manually re-trying has shown to consistenly being not helpful, either. Thus use THE FORCE.
                exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl delete pod --namespace ${namespace} ${o} --ignore-not-found=true --force`, { ...shellOpts });
            }
        } catch (err) {
            const result = exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get pod --namespace ${namespace} ${o}`, { dontCheckRc: true });
            if (result.code === 0) {
                console.error(`unable to patch/delete ${o} but it's still on the dataplane`);
            }
        }
    });
}

// deleteAllUnnamespacedObjects deletes all unnamespaced objects for the given namespace
async function deleteAllUnnamespacedObjects(pathToKubeConfig: string, namespace: string, shellOpts: ExecOptions): Promise<void> {
    const werft = getGlobalWerftInstance()

    const slice = shellOpts.slice || "deleteobjs";

    const promisedDeletes: Promise<any>[] = [];
    for (const resType of ["clusterrole", "clusterrolebinding", "podsecuritypolicy"]) {
        werft.log(slice, `Deleting old ${resType}s...`);
        const objs = exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get ${resType} --no-headers -o=custom-columns=:metadata.name`)
            .split("\n")
            .map(o => o.trim())
            .filter(o => o.length > 0)
            .filter(o => o.startsWith(`${namespace}-ns-`)); // "{{ .Release.Namespace }}-ns-" is the prefix-pattern we use throughout our helm resources for un-namespaced resources

        for (const obj of objs) {
            promisedDeletes.push(exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl delete ${resType} ${obj}`, { slice, async: true }));
        }
    }
    await Promise.all(promisedDeletes);
}

export function createNamespace(pathToKubeConfig: string, namespace: string, shellOpts: ExecOptions) {
    const result = (exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true }) as ShellString);
    const exists = result.code === 0;
    if (exists) {
        return;
    }

    // (re-)create namespace
    [
        `export KUBECONFIG=${pathToKubeConfig} && kubectl create namespace ${namespace}`,
        `export KUBECONFIG=${pathToKubeConfig} && kubectl patch namespace ${namespace} --patch '{"metadata": {"labels": {"${IS_PREVIEW_APP_LABEL}": "true"}}}'`
    ].forEach((cmd) => exec(cmd, shellOpts));
};

export function listAllPreviewNamespaces(pathToKubeConfig: string): string[] {
    return exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get namespaces -l ${IS_PREVIEW_APP_LABEL}=true -o=custom-columns=:metadata.name`, { silent: true })
        .stdout
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);
}

export function deleteNamespace(pathToKubeConfig: string, wait: boolean, namespace: string, shellOpts: ExecOptions) {
    // check if present
    const result = (exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true }) as ShellString);
    if (result.code !== 0) {
        return;
    }

    const cmd = `export KUBECONFIG=${pathToKubeConfig} && kubectl delete namespace ${namespace}`;
    exec(cmd, shellOpts);

    // wait until deletion was successful
    while (wait) {
        const result = (exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true }) as ShellString);
        wait = result.code === 0;
    }
}

export function deleteNonNamespaceObjects(pathToKubeConfig: string, namespace, destname, shellOpts) {
    exec(`export KUBECONFIG=${pathToKubeConfig} && /usr/local/bin/helm3 delete gitpod-${destname} || echo gitpod-${destname} was not installed yet`, { slice: 'predeploy cleanup' });

    let objs = [];
    ["ws-scheduler", "node-daemon", "cluster", "workspace", "jaeger", "jaeger-agent", "ws-sync", "ws-manager-node", "ws-daemon", "registry-facade"].forEach(comp =>
        ["ClusterRole", "ClusterRoleBinding", "PodSecurityPolicy"].forEach(kind =>
            exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get ${kind} -l component=${comp} --no-headers -o=custom-columns=:metadata.name | grep ${namespace}-ns`, { dontCheckRc: true })
                .split("\n")
                .map(o => o.trim())
                .filter(o => o.length > 0)
                .forEach(obj => objs.push({ 'kind': kind, 'obj': obj }))
        )
    )

    objs.forEach(o => {
        exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl delete ${o.kind} ${o.obj}`, shellOpts);
    });
}

export interface PortRange {
    start: number;
    end: number;
}

export function findFreeHostPorts(pathToKubeConfig: string, ranges: PortRange[], slice: string): number[] {
    const werft = getGlobalWerftInstance()

    const hostPorts: number[] = exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl get pods --all-namespaces -o yaml | yq r - 'items.*.spec.containers.*.ports.*.hostPort'`, { silent: true })
        .stdout
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => Number.parseInt(l));

    const alreadyReservedPorts: Set<number> = new Set();
    for (const port of hostPorts) {
        alreadyReservedPorts.add(port);
    }
    werft.log(slice, `already reserved ports: ${Array.from(alreadyReservedPorts.values())}`);

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

export function waitForDeploymentToSucceed(pathToKubeConfig: string, name: string, namespace: string, type: string) {
    exec(`export KUBECONFIG=${pathToKubeConfig} && kubectl rollout status ${type} ${name} -n ${namespace}`)
}
