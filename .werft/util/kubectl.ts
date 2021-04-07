import { exec } from './shell';


export function setKubectlContextNamespace(namespace, shellOpts) {
    [
        "kubectl config current-context",
        `kubectl config set-context --current --namespace=${namespace}`
    ].forEach(cmd => exec(cmd, shellOpts));
}

export function wipeAndRecreateNamespace(namespace, shellOpts) {
    removePodFinalizers(namespace, shellOpts);
    deleteAllWorkspaces(namespace, shellOpts);

    recreateNamespace(namespace, shellOpts);
}

function removePodFinalizers(namespace, shellOpts) {
    const objs = exec(`kubectl get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`)
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);

    objs.forEach(o => {
        exec(`kubectl patch pod --namespace ${namespace} ${o} -p '{"metadata":{"finalizers":null}}'`, shellOpts);
    });
}

function deleteAllWorkspaces(namespace, shellOpts) {
    const objs = exec(`kubectl get pod -l component=workspace --namespace ${namespace} --no-headers -o=custom-columns=:metadata.name`)
        .split("\n")
        .map(o => o.trim())
        .filter(o => o.length > 0);

    objs.forEach(o => {
        exec(`kubectl delete pod --namespace ${namespace} ${o}`, shellOpts);
    });
}

function recreateNamespace(namespace, shellOpts) {
    const result = exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true });
    if (result.code === 0) {
        deleteNamespace(namespace, true, shellOpts);
    }

    // (re-)create namespace
    [
        `kubectl create namespace ${namespace}`,
        `kubectl patch namespace ${namespace} --patch '{"metadata": {"labels": {"isPreviewApp": "true"}}}'`
    ].forEach((cmd) => exec(cmd, shellOpts));
};

function deleteNamespace(namespace, shellOpts, wait) {
    const cmd = `kubectl delete namespace ${namespace}`;
    exec(cmd, shellOpts);

    // wait until deletion was successful
    while (wait) {
        const result = exec(`kubectl get namespace ${namespace}`, { ...shellOpts, dontCheckRc: true });
        wait = result.code === 0;
    }
}

export function deleteNonNamespaceObjects(namespace, destname, shellOpts) {
    exec(`/usr/local/bin/helm3 delete gitpod-${destname} || echo gitpod-${destname} was not installed yet`, {slice: 'predeploy cleanup'});
    exec(`/usr/local/bin/helm3 delete jaeger-${destname} || echo jaeger-${destname} was not installed yet`, {slice: 'predeploy cleanup'});

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
