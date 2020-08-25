const { exec } = require('./shell');


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


module.exports = {
    recreateNamespace
}
