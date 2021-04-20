import { exec } from './shell';
import { sleep } from './util';

export async function issueCertficate(werft, pathToTerraform, gcpSaPath, namespace, dnsZoneDomain, domain: string, ip, additionalWsSubdomains) {
    const subdomains = ["", "*.", "*.ws-dev."];
    if (Array.isArray(subdomains)) {
        for (const sd of additionalWsSubdomains) {
            subdomains.push(`*.ws-${additionalWsSubdomains}.`);
        }
    }

    // sanity: check if there is a "SAN short enough to fit into CN (63 characters max)"
    // source: https://community.letsencrypt.org/t/certbot-errors-with-obtaining-a-new-certificate-an-unexpected-error-occurred-the-csr-is-unacceptable-e-g-due-to-a-short-key-error-finalizing-order-issuing-precertificate-csr-doesnt-contain-a-san-short-enough-to-fit-in-cn/105513/2
    if (!subdomains.some(sd => {
        const san = sd + domain;
        return san.length <= 63;
    })) {
        throw new Error(`there is no subdomain + '${domain}' shorter or equal to 63 characters, max. allowed length for CN. No HTTPS certs for you! Consider using a short branch name...`);
    }

    // Always use 'terraform apply' to make sure the certificate is present and up-to-date
    await exec(`set -x \
        && cd ${pathToTerraform} \
        && export GOOGLE_APPLICATION_CREDENTIALS="${gcpSaPath}" \
        && terraform init -backend-config='prefix=${namespace}'\
        && terraform apply -auto-approve \
            -var 'namespace=${namespace}' \
            -var 'dns_zone_domain=${dnsZoneDomain}' \
            -var 'domain=${domain}' \
            -var 'public_ip=${ip}' \
            -var 'subdomains=[${subdomains.map(s => `"${s}"`).join(", ")}]'`, { slice: 'certificate', async: true });

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
}

export async function installCertficate(werft, fromNamespace, toNamespace, certificateSecretName) {
    werft.log('certificate', `copying certificate from "certs/${fromNamespace}" to "${toNamespace}/${certificateSecretName}"`);
    // certmanager is configured to create a secret in the namespace "certs" with the name "${namespace}".
    exec(`kubectl get secret ${fromNamespace} --namespace=certs -o yaml \
        | yq d - 'metadata.namespace' \
        | yq d - 'metadata.uid' \
        | yq d - 'metadata.resourceVersion' \
        | yq d - 'metadata.creationTimestamp' \
        | sed 's/${fromNamespace}/${certificateSecretName}/g' \
        | kubectl apply --namespace=${toNamespace} -f -`);
}