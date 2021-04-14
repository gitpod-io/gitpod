import { ShellString } from 'shelljs';
import { exec, ExecOptions } from './shell';


export function setKubectlContextNamespace(namespace, shellOpts) {
    [
        "kubectl config current-context",
        `kubectl config set-context --current --namespace=${namespace}`
    ].forEach(cmd => exec(cmd, shellOpts));
}

export function wipeAndRecreateNamespace(helmInstallName: string, namespace: string, shellOpts: ExecOptions) {
    // uninstall helm first so that:
    //  - ws-scaler can't create new ghosts in the meantime
    //  - ws-manager can't start new probes/workspaces
    uninstallHelm(helmInstallName, namespace, shellOpts)

    deleteAllWorkspaces(namespace, shellOpts);

    recreateNamespace(namespace, shellOpts);
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

function recreateNamespace(namespace: string, shellOpts: ExecOptions) {
    const result = (exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true }) as ShellString);
    if (result.code === 0) {
        deleteNamespace(true, namespace, shellOpts);
    }

    // (re-)create namespace
    [
        `kubectl create namespace ${namespace}`,
        `kubectl patch namespace ${namespace} --patch '{"metadata": {"labels": {"isPreviewApp": "true"}}}'`
    ].forEach((cmd) => exec(cmd, shellOpts));
};

function deleteNamespace(wait: boolean, namespace: string, shellOpts: ExecOptions) {
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
    exec(`/usr/local/bin/helm3 delete jaeger-${destname} || echo jaeger-${destname} was not installed yet`, { slice: 'predeploy cleanup' });

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
