const { exec } = require('./shell');
const { sleep } = require('./util.js');

async function issueAndInstallCertficate(werft, pathToTerraform, gcpSaPath, namespace, dnsZoneDomain, domain, ip, namespaceRecreatedPromise, certificateSecretName) {
    // Always use 'terraform apply' to make sure the certificate is present and up-to-date
    await exec(`set -x \
        && cd ${pathToTerraform} \
        && terraform init \
        && export GOOGLE_APPLICATION_CREDENTIALS="${gcpSaPath}" \
        && terraform apply -auto-approve \
            -var 'namespace=${namespace}' \
            -var 'dns_zone_domain=${dnsZoneDomain}' \
            -var 'domain=${domain}' \
            -var 'public_ip=${ip}' \
            -var 'subdomains=["", "*.", "*.ws-dev."]'`, {slice: 'certificate', async: true});

    werft.log('certificate', `waiting until certificate certs/${namespace} is ready...`)
    let notReadyYet = true;
    while (notReadyYet) {
        werft.log('certificate', `polling state of certs/${namespace}...`)
        const result = exec(`kubectl -n certs get certificate ${namespace} -o jsonpath="{.status.conditions[?(@.type == 'Ready')].status}"`, { silent: true, dontCheckRc: true });
        if (result.code === 0 && result.stdout === "True") {
            notReadyYet = false;
            break;
        }

        sleep(5000);
    }

    werft.log('certificate', 'waiting for preview env namespace being re-created...');
    await namespaceRecreatedPromise;

    werft.log('certificate', `copying certificate from "certs/${namespace}" to "${namespace}/${certificateSecretName}"`);
    // certmanager is configured to create a secret in the namespace "certs" with the name "${namespace}".
    exec(`kubectl get secret ${namespace} --namespace=certs -o yaml \
        | yq d - 'metadata.namespace' \
        | yq d - 'metadata.uid' \
        | yq d - 'metadata.resourceVersion' \
        | yq d - 'metadata.creationTimestamp' \
        | sed 's/${namespace}/${certificateSecretName}/g' \
        | kubectl apply --namespace=${namespace} -f -`);
}

module.exports = {
    issueAndInstallCertficate,
}