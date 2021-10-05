import { exec } from './shell';
import { sleep } from './util';
import { readFileSync, writeFileSync } from 'fs';

const deleteCA = `-----BEGIN CERTIFICATE-----
MIIFYDCCBEigAwIBAgIQQAF3ITfU6UK47naqPGQKtzANBgkqhkiG9w0BAQsFADA/
MSQwIgYDVQQKExtEaWdpdGFsIFNpZ25hdHVyZSBUcnVzdCBDby4xFzAVBgNVBAMT
DkRTVCBSb290IENBIFgzMB4XDTIxMDEyMDE5MTQwM1oXDTI0MDkzMDE4MTQwM1ow
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCt6CRz9BQ385ueK1coHIe+3LffOJCMbjzmV6B493XC
ov71am72AE8o295ohmxEk7axY/0UEmu/H9LqMZshftEzPLpI9d1537O4/xLxIZpL
wYqGcWlKZmZsj348cL+tKSIG8+TA5oCu4kuPt5l+lAOf00eXfJlII1PoOK5PCm+D
LtFJV4yAdLbaL9A4jXsDcCEbdfIwPPqPrt3aY6vrFk/CjhFLfs8L6P+1dy70sntK
4EwSJQxwjQMpoOFTJOwT2e4ZvxCzSow/iaNhUd6shweU9GNx7C7ib1uYgeGJXDR5
bHbvO5BieebbpJovJsXQEOEO3tkQjhb7t/eo98flAgeYjzYIlefiN5YNNnWe+w5y
sR2bvAP5SQXYgd0FtCrWQemsAXaVCg/Y39W9Eh81LygXbNKYwagJZHduRze6zqxZ
Xmidf3LWicUGQSk+WT7dJvUkyRGnWqNMQB9GoZm1pzpRboY7nn1ypxIFeFntPlF4
FQsDj43QLwWyPntKHEtzBRL8xurgUBN8Q5N0s8p0544fAQjQMNRbcTa0B7rBMDBc
SLeCO5imfWCKoqMpgsy6vYMEG6KDA0Gh1gXxG8K28Kh8hjtGqEgqiNx2mna/H2ql
PRmP6zjzZN7IKw0KKP/32+IVQtQi0Cdd4Xn+GOdwiK1O5tmLOsbdJ1Fu/7xk9TND
TwIDAQABo4IBRjCCAUIwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYw
SwYIKwYBBQUHAQEEPzA9MDsGCCsGAQUFBzAChi9odHRwOi8vYXBwcy5pZGVudHJ1
c3QuY29tL3Jvb3RzL2RzdHJvb3RjYXgzLnA3YzAfBgNVHSMEGDAWgBTEp7Gkeyxx
+tvhS5B1/8QVYIWJEDBUBgNVHSAETTBLMAgGBmeBDAECATA/BgsrBgEEAYLfEwEB
ATAwMC4GCCsGAQUFBwIBFiJodHRwOi8vY3BzLnJvb3QteDEubGV0c2VuY3J5cHQu
b3JnMDwGA1UdHwQ1MDMwMaAvoC2GK2h0dHA6Ly9jcmwuaWRlbnRydXN0LmNvbS9E
U1RST09UQ0FYM0NSTC5jcmwwHQYDVR0OBBYEFHm0WeZ7tuXkAXOACIjIGlj26Ztu
MA0GCSqGSIb3DQEBCwUAA4IBAQAKcwBslm7/DlLQrt2M51oGrS+o44+/yQoDFVDC
5WxCu2+b9LRPwkSICHXM6webFGJueN7sJ7o5XPWioW5WlHAQU7G75K/QosMrAdSW
9MUgNTP52GE24HGNtLi1qoJFlcDyqSMo59ahy2cI2qBDLKobkx/J3vWraV0T9VuG
WCLKTVXkcGdtwlfFRjlBz4pYg1htmf5X6DYO8A4jqv2Il9DjXA6USbW1FzXSLr9O
he8Y4IWS6wY7bCkjCWDcRQJMEhg76fsO3txE+FiYruq9RUWhiF1myv4Q6W+CyBFC
Dfvp7OOGAN6dEOM4+qR9sdjoSYKEBpsr6GtPAQw4dy753ec5
-----END CERTIFICATE-----`

export class IssueCertificateParams {
    pathToTerraform: string
    gcpSaPath: string
    namespace: string
    dnsZoneDomain: string
    domain: string
    ip: string
    additionalSubdomains: string[]
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

export async function issueCertficate(werft, params: IssueCertificateParams) {
    var subdomains = [];
    werft.log("certificate", `Subdomains: ${params.additionalSubdomains}`)
    for (const sd of params.additionalSubdomains) {
        subdomains.push(sd);
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
    && terraform init -backend-config='prefix=${params.namespace}${params.bucketPrefixTail}' -migrate-state -upgrade \
    && terraform apply -auto-approve \
        -var 'namespace=${params.namespace}' \
        -var 'dns_zone_domain=${params.dnsZoneDomain}' \
        -var 'domain=${params.domain}' \
        -var 'public_ip=${params.ip}' \
        -var 'cert_namespace=${params.certNamespace}' \
        -var 'subdomains=[${subdomains.map(s => `"${s}"`).join(", ")}]'`;

    werft.log("certificate", "Terraform command for cert creation: " + cmd)
    exec(cmd, { slice: 'certificate' });

    werft.log('certificate', `waiting until certificate ${params.certNamespace}/${params.namespace} is ready...`)
    let notReadyYet = true;
    for (let i = 0; i < 90 && notReadyYet; i++) {
        werft.log('certificate', `polling state of ${params.certNamespace}/${params.namespace}...`)
        const result = exec(`export KUBECONFIG=${params.pathToKubeConfig} && kubectl -n ${params.certNamespace} get certificate ${params.namespace} -o jsonpath="{.status.conditions[?(@.type == 'Ready')].status}"`, { silent: true, dontCheckRc: true });
        if (result != undefined && result.code === 0 && result.stdout === "True") {
            notReadyYet = false;
            break;
        }

        await sleep(5000);
    }
}

export async function installCertficate(werft, params: InstallCertificateParams) {
    let notReadyYet = true;
    werft.log('certificate', `copying certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`);
    const exportCert = `export KUBECONFIG=${params.pathToKubeConfig} && rm -f cert.yml tls.crt && kubectl get secret ${params.certName} --namespace=${params.certNamespace} -o yaml \
    | yq d - 'metadata.namespace' \
    | yq d - 'metadata.uid' \
    | yq d - 'metadata.resourceVersion' \
    | yq d - 'metadata.creationTimestamp' \
    | sed 's/${params.certName}/${params.certSecretName}/g' > cert.yml \
    && yq r cert.yml data[tls.crt] | base64 -d > tls.crt`
    
    const importCert = `export KUBECONFIG=${params.pathToKubeConfig} && cat cert.yml \
    | yq w - data.[tls.crt] $(cat tls.crt | base64 -w 0) \
    | kubectl apply --namespace=${params.destinationNamespace} -f -`

    for (let i = 0; i < 60 && notReadyYet; i++) {
        let result = exec(exportCert, { silent: true, dontCheckRc: true });
        if (result != undefined && result.code === 0) {
            let cert = readFileSync('tls.crt').toString()
            cert = cert.replace(deleteCA, '')
            writeFileSync('tls.crt', cert)
            result = exec(importCert, { silent: true, dontCheckRc: true })
            if (result != undefined && result.code === 0) {
                notReadyYet = false;
                break;
            }
        }
        werft.log('certificate', `Could not copy "${params.certNamespace}/${params.certName}", will retry`);
        await sleep(5000);
    }
    if (!notReadyYet) {
        werft.log('certificate', `copied certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`);
    } else {
        werft.fail('certificate', `failed to copy certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`)
    }
}