import { exec, ExecOptions } from "./shell";
import * as path from "path";
import { CORE_DEV_KUBECONFIG_PATH } from "../jobs/build/const";
import { Werft } from "./werft";
import { reportCertificateError } from "../util/slack";

export class IssueCertificateParams {
    pathToTemplate: string;
    gcpSaPath: string;
    dnsZoneDomain: string;
    domain: string;
    ip: string;
    additionalSubdomains: string[];
    bucketPrefixTail: string;
    certName: string;
    certNamespace: string;
    previewName: string
}

export class InstallCertificateParams {
    certName: string;
    certSecretName: string;
    certNamespace: string;
    destinationNamespace: string;
    destinationKubeconfig: string;
}

export async function issueCertificate(werft: Werft, params: IssueCertificateParams, shellOpts: ExecOptions): Promise<boolean> {
    if (isCertReady(params.certName)){
        werft.log(shellOpts.slice, `Certificate ready`);
        return true
    }

    var subdomains = [];
    werft.log(shellOpts.slice, `Subdomains: ${params.additionalSubdomains}`);
    for (const sd of params.additionalSubdomains) {
        subdomains.push(sd);
    }

    werft.log(shellOpts.slice, `"Domain: ${params.domain}, Subdomains: ${subdomains}"`);
    validateSubdomains(werft, shellOpts.slice, params.domain, subdomains);

    const maxAttempts = 5
    var certReady = false
    for (var i = 1;i<=maxAttempts;i++) {
        werft.log(shellOpts.slice, `Creating cert: Attempt ${i}`);
        createCertificateResource(werft, shellOpts, params, subdomains);
        werft.log(shellOpts.slice, `Checking for cert readiness: Attempt ${i}`);
        if (waitCertReady(params.certName)) {
            certReady = true;
            break;
        }
        deleteCertificateResource(werft, shellOpts, params)
    }
    if (!certReady) {
        retrieveFailedCertDebug(params.certName, shellOpts.slice)
        werft.fail(shellOpts.slice, `Certificate ${params.certName} never reached the Ready state`)
    }
    return certReady
}

function waitCertReady(certName: string): boolean {
    const timeout = "180s"
    const rc = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} wait --for=condition=Ready --timeout=${timeout} -n certs certificate ${certName}`,
        { dontCheckRc: true },
    ).code
    return rc == 0
}

function isCertReady(certName: string): boolean {
    const rc = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n certs get certificate ${certName} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'`,
        { dontCheckRc: true }
    ).stdout.trim();

    return rc == "True";
}

function retrieveFailedCertDebug(certName: string, slice: string) {
    const certificateYAML = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n certs get certificate ${certName} -o yaml`,
        { silent: true },
    ).stdout.trim();
    const certificateDebug = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} cmctl status certificate ${certName} -n certs`);
    exec(`kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n certs delete certificate ${certName}`, {
        slice: slice,
    });
    reportCertificateError({ certificateName: certName, certifiateYAML: certificateYAML, certificateDebug: certificateDebug }).catch((error: Error) =>
        console.error("Failed to send message to Slack", error),
    );
}

function validateSubdomains(werft: Werft, slice: string, domain: string, subdomains: string[]): void {
    // sanity: check if there is a "SAN short enough to fit into CN (63 characters max)"
    // source: https://community.letsencrypt.org/t/certbot-errors-with-obtaining-a-new-certificate-an-unexpected-error-occurred-the-csr-is-unacceptable-e-g-due-to-a-short-key-error-finalizing-order-issuing-precertificate-csr-doesnt-contain-a-san-short-enough-to-fit-in-cn/105513/2
    if (
        !subdomains.some((sd) => {
            const san = sd + domain;
            return san.length <= 63;
        })
    ) {
        werft.fail(
            slice,
            `there is no subdomain + '${domain}' shorter or equal to 63 characters, max. allowed length for CN. No HTTPS certs for you! Consider using a short branch name...`,
        );
    }
}

function createCertificateResource(
    werft: Werft,
    shellOpts: ExecOptions,
    params: IssueCertificateParams,
    subdomains: string[],
) {
    // Certificates are always issued in the core-dev cluster.
    // They might be copied to other clusters in future steps.
    var cmd = `set -x \
    && cd ${path.join(params.pathToTemplate)} \
    && cp cert-manager_certificate.tpl cert.yaml \
    && yq w -i cert.yaml metadata.name '${params.certName}' \
    && yq w -i cert.yaml spec.secretName '${params.certName}' \
    && yq w -i cert.yaml metadata.namespace '${params.certNamespace}' \
    && yq w -i cert.yaml spec.issuerRef.name 'letsencrypt-issuer-gitpod-core-dev' \
    && yq w -i cert.yaml metadata.annotations.preview/owner '${params.previewName}' \
    ${subdomains.map((s) => `&& yq w -i cert.yaml spec.dnsNames[+] '${s + params.domain}'`).join("  ")} \
    && kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} apply -f cert.yaml`;

    werft.log(shellOpts.slice, "Creating certificate Custom Resource");
    const rc = exec(cmd, { slice: shellOpts.slice, dontCheckRc: true }).code;

    if (rc != 0) {
        werft.fail(shellOpts.slice, `Failed to create the certificate (${params.certName}) Custom Resource`);
    }
}

function deleteCertificateResource(
    werft: Werft,
    shellOpts: ExecOptions,
    params: IssueCertificateParams,
) {
    const rc = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n ${params.certNamespace} delete ${params.certName}`,
        { slice: shellOpts.slice, dontCheckRc: true }
    ).code;

    if (rc != 0) {
        werft.fail(shellOpts.slice, `Failed to delete the certificate (${params.certName}) Custom Resource`);
    }
}

export async function installCertificate(werft, params: InstallCertificateParams, shellOpts: ExecOptions) {
    copyCachedSecret(werft, params, shellOpts.slice);
}

function copyCachedSecret(werft: Werft, params: InstallCertificateParams, slice: string) {
    werft.log(
        slice,
        `copying certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`,
    );
    const cmd = `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} get secret ${params.certName} --namespace=${params.certNamespace} -o yaml \
    | yq d - 'metadata.namespace' \
    | yq d - 'metadata.uid' \
    | yq d - 'metadata.resourceVersion' \
    | yq d - 'metadata.creationTimestamp' \
    | yq d - 'metadata.ownerReferences' \
    | sed 's/${params.certName}/${params.certSecretName}/g' \
    | kubectl --kubeconfig ${params.destinationKubeconfig} apply --namespace=${params.destinationNamespace} -f -`;

    const rc = exec(cmd, { slice: slice, dontCheckRc: true }).code;

    if (rc != 0) {
        werft.fail(
            slice,
            `Failed to copy certificate. Destination namespace: ${params.destinationNamespace}. Destination Kubeconfig: ${params.destinationKubeconfig}`,
        );
    }
}
