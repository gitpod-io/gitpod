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
    includeDefaults: boolean
    pathToKubeConfig: string
}

function getDefaultSubDomains(): string[] {
    return ["", "*.", "*.ws-dev."];
}

export async function issueCertficate(werft, params: IssueCertificateParams) {
    const subdomains = params.includeDefaults ? getDefaultSubDomains() : [];
    for (const sd of params.additionalWsSubdomains) {
        subdomains.push(`*.ws-${sd}.`);
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
    && cd ${params.pathToTerraform} \
    && export GOOGLE_APPLICATION_CREDENTIALS="${params.gcpSaPath}" \
    && terraform init -backend-config='prefix=${params.namespace}'\
    && terraform apply -auto-approve \
        -var 'namespace=${params.namespace}' \
        -var 'dns_zone_domain=${params.dnsZoneDomain}' \
        -var 'domain=${params.domain}' \
        -var 'public_ip=${params.ip}' \
        -var 'kube_config_path=${params.pathToKubeConfig}' \
        -var 'subdomains=[${subdomains.map(s => `"${s}"`).join(", ")}]'`;

    if (params.pathToKubeConfig != "") {
        cmd = `export KUBE_LOAD_CONFIG_FILE=` + params.pathToKubeConfig + " && " + cmd
        werft.log("certificate", "k3s certificate command: " + cmd)
    }

    await exec(cmd, { slice: 'certificate', async: true });

    werft.log('certificate', `waiting until certificate certs/${params.namespace} is ready...`)
    let notReadyYet = true;
    while (notReadyYet) {
        werft.log('certificate', `polling state of certs/${params.namespace}...`)
        const result = exec(`kubectl -n certs get certificate ${params.namespace} -o jsonpath="{.status.conditions[?(@.type == 'Ready')].status}"`, { silent: true, dontCheckRc: true });
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