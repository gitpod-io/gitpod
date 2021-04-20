import { ShellString } from 'shelljs';
import { exec, ExecOptions, werft } from './shell';


export const IS_PREVIEW_APP_LABEL: string = "isPreviewApp";

export function setKubectlContextNamespace(namespace, shellOpts) {
    [
        "kubectl config current-context",
        `kubectl config set-context --current --namespace=${namespace}`
    ].forEach(cmd => exec(cmd, shellOpts));
}

export async function wipeAndRecreateNamespace(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    await wipePreviewEnvironment(helmInstallName, namespace, shellOpts);

    createNamespace(namespace, shellOpts);
}

export async function wipePreviewEnvironment(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    // uninstall helm first so that:
    //  - ws-scaler can't create new ghosts in the meantime
    //  - ws-manager can't start new probes/workspaces
    uninstallHelm(helmInstallName, namespace, shellOpts)

    deleteAllWorkspaces(namespace, shellOpts);
    await deleteAllUnnamespacedObjects(namespace, shellOpts);

    deleteNamespace(true, namespace, shellOpts);
}

function uninstallHelm(installationName: string, namespace: string, shellOpts: ExecOptions) {
    const installations = exec(`helm --namespace ${namespace} list -q`, { silent: true, dontCheckRc: true })
        .stdout
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);
    if (!installations.some(i => i === installationName)) {
        return;
    }

    exec(`helm --namespace ${namespace} delete ${installationName}`, shellOpts);
}

function deleteAllWorkspaces(namespace: string, shellOpts: ExecOptions) {
    const objs = exec(`kubectl get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`)
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);

    objs.forEach(o => {
        try {
            // In most cases the calls below fails because the workspace is already gone. Ignore those cases, log others.
            exec(`kubectl patch pod --namespace ${namespace} ${o} -p '{"metadata":{"finalizers":null}}'`, { ...shellOpts });
            exec(`kubectl delete pod --namespace ${namespace} ${o}`, { ...shellOpts });
        } catch (err) {
            const result = exec(`kubectl get pod --namespace ${namespace} ${o}`, { dontCheckRc: true });
            if (result.code === 0) {
                console.error(`unable to patch/delete ${o} but it's still on the dataplane`);
            }
        }
    });
}

// deleteAllUnnamespacedObjects deletes all unnamespaced objects for the given namespace
async function deleteAllUnnamespacedObjects(namespace: string, shellOpts: ExecOptions): Promise<void> {
    const slice = shellOpts.slice || "deleteobjs";

    const promisedDeletes: Promise<any>[] = [];
    for (const resType of ["clusterrole", "clusterrolebinding", "podsecuritypolicy"]) {
        werft.log(slice, `Deleting old ${resType}s...`);
        const objs = exec(`kubectl get ${resType} --no-headers -o=custom-columns=:metadata.name`)
            .split("\n")
            .map(o => o.trim())
            .filter(o => o.length > 0)
            .filter(o => o.startsWith(`${namespace}-ns-`)); // "{{ .Release.Namespace }}-ns-" is the prefix-pattern we use throughout our helm resources for un-namespaced resources

        for (const obj of objs) {
            promisedDeletes.push(exec(`kubectl delete ${resType} ${obj}`, { slice, async: true }));
        }
    }
    await Promise.all(promisedDeletes);
}

function createNamespace(namespace: string, shellOpts: ExecOptions) {
    // (re-)create namespace
    [
        `kubectl create namespace ${namespace}`,
        `kubectl patch namespace ${namespace} --patch '{"metadata": {"labels": {"${IS_PREVIEW_APP_LABEL}": "true"}}}'`
    ].forEach((cmd) => exec(cmd, shellOpts));
};

export function listAllPreviewNamespaces(): string[] {
    return exec(`kubectl get namespaces -l ${IS_PREVIEW_APP_LABEL}=true -o=custom-columns=:metadata.name`, { silent: true })
        .stdout
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);
}

export function deleteNamespace(wait: boolean, namespace: string, shellOpts: ExecOptions) {
    // check if present
    const result = (exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true }) as ShellString);
    if (result.code !== 0) {
        return;
    }

    const cmd = `kubectl delete namespace ${namespace}`;
    exec(cmd, shellOpts);

    // wait until deletion was successful
    while (wait) {
        const result = (exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true }) as ShellString);
        wait = result.code === 0;
    }
}

export function deleteNonNamespaceObjects(namespace, destname, shellOpts) {
    exec(`/usr/local/bin/helm3 delete gitpod-${destname} || echo gitpod-${destname} was not installed yet`, { slice: 'predeploy cleanup' });

    let objs = [];
    ["ws-scheduler", "node-daemon", "cluster", "workspace", "jaeger", "jaeger-agent", "ws-sync", "ws-manager-node", "ws-daemon", "registry-facade"].forEach(comp =>
        ["ClusterRole", "ClusterRoleBinding", "PodSecurityPolicy"].forEach(kind =>
            exec(`kubectl get ${kind} -l component=${comp} --no-headers -o=custom-columns=:metadata.name | grep ${namespace}-ns`, { dontCheckRc: true })
                .split("\n")
                .map(o => o.trim())
                .filter(o => o.length > 0)
                .forEach(obj => objs.push({ 'kind': kind, 'obj': obj }))
        )
    )

    objs.forEach(o => {
        exec(`kubectl delete ${o.kind} ${o.obj}`, shellOpts);
    });
}

export interface PortRange {
    start: number;
    end: number;
}

export function findFreeHostPorts(ranges: PortRange[], slice: string): number[] {
    const hostPorts: number[] = exec(`kubectl get pods --all-namespaces -o yaml | yq r - 'items.*.spec.containers.*.ports.*.hostPort'`, { silent: true })
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
