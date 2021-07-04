import { exec } from './shell';
import { sleep } from './util';


export class IssueCertificateParams {
    pathToTerraform: string
    gcpSaPath: string
    namespace: string
    dnsZoneDomain: string
    domain: string
    ip: string
    additionalWsSubdomains: string[]
    additionalSubdomains: string[]
    includeDefaults: boolean
    pathToKubeConfig: string
    bucketPrefixTail: string
    certNamespace: string
}

export class InstallCertificateParams {
    pathToKubeConfig: string
    certName: string
    certSecretName: string
    certNamespace: string
    destinationNamespace: string
}

function getDefaultSubDomains(): string[] {
    return ["*.", "*.ws-dev."];
}

export async function issueCertficate(werft, params: IssueCertificateParams) {
    var subdomains = [];
    werft.log("certificate", `WS Subdomains: ${params.additionalWsSubdomains}`)
    werft.log("certificate", `Subdomains: ${params.additionalSubdomains}`)
    for (const wssd of params.additionalWsSubdomains) {
        subdomains.push(`*.ws-${wssd}.`);
    }
    for (const sd of params.additionalSubdomains) {
        subdomains.push(`${sd}.`);
    }

    // sanity: check if there is a "SAN short enough to fit into CN (63 characters max)"
    // source: https://community.letsencrypt.org/t/certbot-errors-with-obtaining-a-new-certificate-an-unexpected-error-occurred-the-csr-is-unacceptable-e-g-due-to-a-short-key-error-finalizing-order-issuing-precertificate-csr-doesnt-contain-a-san-short-enough-to-fit-in-cn/105513/2
    if (!subdomains.some(sd => {
        const san = sd + params.domain;
        return san.length <= 63;
    })) {
        throw new Error(`there is no subdomain + '${params.domain}' shorter or equal to 63 characters, max. allowed length for CN. No HTTPS certs for you! Consider using a short branch name...`);
    }

    // Always use 'terraform apply' to make sure the certificate is present and up-to-date
    var cmd = `set -x \
    && export KUBECONFIG="${params.pathToKubeConfig}" \
    && cd ${params.pathToTerraform} \
    && rm -rf .terraform* \
    && export GOOGLE_APPLICATION_CREDENTIALS="${params.gcpSaPath}" \
    && terraform init -backend-config='prefix=${params.namespace}${params.bucketPrefixTail}' -migrate-state \
    && terraform apply -auto-approve \
        -var 'namespace=${params.namespace}' \
        -var 'dns_zone_domain=${params.dnsZoneDomain}' \
        -var 'domain=${params.domain}' \
        -var 'public_ip=${params.ip}' \
        -var 'cert_namespace=${params.certNamespace}' \
        -var 'subdomains=[${subdomains.map(s => `"${s}"`).join(", ")}]'`;

    werft.log("certificate", "Terraform command for cert creation: " + cmd)
    await exec(cmd, { slice: 'certificate', async: true });

    werft.log('certificate', `waiting until certificate ${params.certNamespace}/${params.namespace} is ready...`)
    let notReadyYet = true;
    for(let i=0; i<60 && notReadyYet; i++) {
        werft.log('certificate', `polling state of certs/${params.namespace}...`)
        const result = exec(`export KUBECONFIG=${params.pathToKubeConfig} && kubectl -n ${params.certNamespace} get certificate ${params.namespace} -o jsonpath="{.status.conditions[?(@.type == 'Ready')].status}"`, { silent: true, dontCheckRc: true });
        if (result != undefined && result.code === 0 && result.stdout === "True") {
            notReadyYet = false;
            break;
        }

        sleep(5000);
    }
}

export async function installCertficate(werft, params: InstallCertificateParams) {
    werft.log('certificate', `copying certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`);
    // certmanager is configured to create a secret in the namespace "certs" with the name "${namespace}".
    exec(`export KUBECONFIG=${params.pathToKubeConfig} && kubectl get secret ${params.certName} --namespace=${params.certNamespace} -o yaml \
        | yq d - 'metadata.namespace' \
        | yq d - 'metadata.uid' \
        | yq d - 'metadata.resourceVersion' \
        | yq d - 'metadata.creationTimestamp' \
        | sed 's/${params.certName}/${params.certSecretName}/g' \
        | kubectl apply --namespace=${params.destinationNamespace} -f -`);
}