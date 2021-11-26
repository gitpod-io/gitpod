import { ShellString } from 'shelljs';
import { exec, ExecOptions } from './shell';
import { getGlobalWerftInstance } from './werft';


export const IS_PREVIEW_APP_LABEL: string = "isPreviewApp";

export const helmInstallName = "gitpod";

export function setKubectlContextNamespace(namespace: string, shellOpts: ExecOptions) {
    [
        `kubectl config current-context`,
        `kubectl config set-context --current --namespace=${namespace}`
    ].forEach(cmd => exec(cmd, shellOpts));
}

export async function wipeAndRecreateNamespace(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    // wipe preview envs previously built with helm
    await wipePreviewEnvironmentHelm(helmInstallName, namespace, shellOpts)

    // wipe preview envs built with installer
    await wipePreviewEnvironmentInstaller(namespace, shellOpts);

    createNamespace(namespace, shellOpts);
}

export async function wipePreviewEnvironmentHelm(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    // uninstall helm first so that:
    //  - ws-scaler can't create new ghosts in the meantime
    //  - ws-manager can't start new probes/workspaces
    uninstallHelm(helmInstallName, namespace, shellOpts)

    deleteAllWorkspaces(namespace, shellOpts);
    await deleteAllUnnamespacedObjects(namespace, shellOpts);

    deleteNamespace(true, namespace, shellOpts);
}

async function wipePreviewEnvironmentInstaller(namespace: string, shellOpts: ExecOptions) {
    const slice = shellOpts.slice || "installer";
    const werft = getGlobalWerftInstance();

    const hasGitpodConfigmap = (exec(`kubectl -n ${namespace} get configmap gitpod-app -o jsonpath={".data.app\.yaml"}`, { slice, dontCheckRc: true })).code === 0;
    if (hasGitpodConfigmap) {
        werft.log(slice, `Has Gitpod configmap, proceeding with removal`);
        exec(`kubectl -n ${namespace} get configmap gitpod-app -o jsonpath={".data.app\.yaml"} | kubectl delete -f -`, { slice });
        exec(`kubectl -n ${namespace} delete pvc data-mysql-0 minio || true`, { slice });
    }

    deleteAllWorkspaces(namespace, shellOpts);
    await deleteAllUnnamespacedObjects(namespace, shellOpts);

    deleteNamespace(true, namespace, shellOpts);
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

export function deleteNonNamespaceObjects(namespace: string, destname: string, shellOpts: ExecOptions) {
    exec(`/usr/local/bin/helm3 delete gitpod-${destname} || echo gitpod-${destname} was not installed yet`, { ...shellOpts });

    let objs = [];
    ["ws-scheduler", "node-daemon", "cluster", "workspace", "jaeger", "jaeger-agent", "ws-sync", "ws-manager-node", "ws-daemon", "registry-facade"].forEach(comp =>
        ["ClusterRole", "ClusterRoleBinding", "PodSecurityPolicy"].forEach(kind =>
            exec(`kubectl get ${kind} -l component=${comp} --no-headers -o=custom-columns=:metadata.name | grep ${namespace}-ns`, { ...shellOpts, dontCheckRc: true, async: false })
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

export function findFreeHostPorts(ranges: PortRange[], shellOpts: ExecOptions): number[] {
    const werft = getGlobalWerftInstance()
    const hostPorts: number[] = exec(`kubectl get pods --all-namespaces -o yaml | yq r - 'items.*.spec.containers.*.ports.*.hostPort'`, { ...shellOpts, silent: true, async: false })
        .stdout
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => Number.parseInt(l));

    const alreadyReservedPorts: Set<number> = new Set();
    for (const port of hostPorts) {
        alreadyReservedPorts.add(port);
    }
    werft.log(shellOpts.slice, `already reserved ports: ${Array.from(alreadyReservedPorts.values())}`);

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
