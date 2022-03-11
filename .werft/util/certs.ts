import { exec, ExecOptions } from './shell';
import { sleep } from './util';
import * as path from 'path';
import { getGlobalWerftInstance, Werft } from './werft';


export class IssueCertificateParams {
    pathToTemplate: string
    gcpSaPath: string
    namespace: string
    dnsZoneDomain: string
    domain: string
    ip: string
    additionalSubdomains: string[]
    bucketPrefixTail: string
    certNamespace: string
}

export class InstallCertificateParams {
    certName: string
    certSecretName: string
    certNamespace: string
    destinationNamespace: string
}

export async function issueCertficate(params: IssueCertificateParams, shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance()

    var subdomains = [];
    werft.log(shellOpts.slice, `Subdomains: ${params.additionalSubdomains}`)
    for (const sd of params.additionalSubdomains) {
        subdomains.push(sd);
    }

    try {
        checkCharacterLimit(params.domain, subdomains)
        applyCertificateManifest(params.pathToTemplate, params.namespace, params.certNamespace, params.domain, subdomains, shellOpts)
    } catch (err) {
        throw new Error(err)
    }
}

// Check if there is a "SAN short enough to fit into CN (63 characters max)".
// source: https://community.letsencrypt.org/t/certbot-errors-with-obtaining-a-new-certificate-an-unexpected-error-occurred-the-csr-is-unacceptable-e-g-due-to-a-short-key-error-finalizing-order-issuing-precertificate-csr-doesnt-contain-a-san-short-enough-to-fit-in-cn/105513/2
function checkCharacterLimit(domain, subdomains) {
    if (!subdomains.some(sd => {
        const san = sd + domain;
        return san.length <= 63;
    })) {
        throw new Error(`there is no subdomain + '${domain}' shorter or equal to 63 characters, max. allowed length for CN. No HTTPS certs for you! Consider using a shorter branch name...`);
    }
}

function applyCertificateManifest(pathToTemplate: string, namespace: string, certNamespace: string, domain: string, subdomains: string[], shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance()

    var cmd = `set -x \
    && cd ${path.join(pathToTemplate)} \
    && cp cert-manager_certificate.tpl cert.yaml \
    && yq w -i cert.yaml metadata.name '${namespace}' \
    && yq w -i cert.yaml spec.secretName '${namespace}' \
    && yq w -i cert.yaml metadata.namespace '${certNamespace}' \
    ${subdomains.map(s => `&& yq w -i cert.yaml spec.dnsNames[+] '${s + domain}'`).join('  ')} \
    && kubectl apply -f cert.yaml`;

    werft.log(shellOpts.slice, "Kubectl command for cert creation: " + cmd)
    exec(cmd, { ...shellOpts, slice: shellOpts.slice });
}

export async function installCertficate(params: InstallCertificateParams, shellOpts: ExecOptions) {
    const werft = getGlobalWerftInstance()
    let notReadyYet = true;
    werft.log(shellOpts.slice, `copying certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`);
    const cmd = `kubectl get secret ${params.certName} --namespace=${params.certNamespace} -o yaml \
    | yq d - 'metadata.namespace' \
    | yq d - 'metadata.uid' \
    | yq d - 'metadata.resourceVersion' \
    | yq d - 'metadata.creationTimestamp' \
    | sed 's/${params.certName}/${params.certSecretName}/g' \
    | kubectl apply --namespace=${params.destinationNamespace} -f -`

    for (let i = 0; i < 60 && notReadyYet; i++) {
        const result = exec(cmd, { ...shellOpts, silent: true, dontCheckRc: true, async: false });
        if (result != undefined && result.code === 0) {
            notReadyYet = false;
            break;
        }
        werft.log(shellOpts.slice, `Could not copy "${params.certNamespace}/${params.certName}", will retry`);
        await sleep(5000);
    }
    if (!notReadyYet) {
        werft.log(shellOpts.slice, `copied certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`);
        werft.done(shellOpts.slice)
    } else {
        werft.fail(shellOpts.slice, `failed to copy certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`)
    }
}

export function waitForCertificateReadiness(name: string, certNamespace: string, slice: string) {
    const werft = getGlobalWerftInstance()
    werft.log(slice, `waiting until certificate ${certNamespace}/${name} is ready...`)
    const execResult = exec(`kubectl wait --for=condition=Ready -n ${certNamespace} certificate ${name} --timeout=600s`, { slice: slice })

    if (execResult.code != 0) {
        throw new Error(execResult.stderr)
    }
}