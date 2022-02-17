import { exec, ExecOptions } from "./shell";
import { sleep } from "./util";
import { readFileSync, writeFileSync } from "fs";
import * as path from "path";

export class IssueCertificateParams {
  pathToTemplate: string;
  gcpSaPath: string;
  namespace: string;
  dnsZoneDomain: string;
  domain: string;
  ip: string;
  additionalSubdomains: string[];
  bucketPrefixTail: string;
  certNamespace: string;
}

export class InstallCertificateParams {
  certName: string;
  certSecretName: string;
  certNamespace: string;
  destinationNamespace: string;
}

export async function issueCertficate(
  werft,
  params: IssueCertificateParams,
  shellOpts: ExecOptions
) {
  var subdomains = [];
  werft.log("certificate", `Subdomains: ${params.additionalSubdomains}`);
  for (const sd of params.additionalSubdomains) {
    subdomains.push(sd);
  }

  // sanity: check if there is a "SAN short enough to fit into CN (63 characters max)"
  // source: https://community.letsencrypt.org/t/certbot-errors-with-obtaining-a-new-certificate-an-unexpected-error-occurred-the-csr-is-unacceptable-e-g-due-to-a-short-key-error-finalizing-order-issuing-precertificate-csr-doesnt-contain-a-san-short-enough-to-fit-in-cn/105513/2
  if (
    !subdomains.some((sd) => {
      const san = sd + params.domain;
      return san.length <= 63;
    })
  ) {
    throw new Error(
      `there is no subdomain + '${params.domain}' shorter or equal to 63 characters, max. allowed length for CN. No HTTPS certs for you! Consider using a short branch name...`
    );
  }
  var cmd = `set -x \
    && cd ${path.join(params.pathToTemplate)} \
    && cp cert-manager_certificate.tpl cert.yaml \
    && yq w -i cert.yaml metadata.name '${params.namespace}' \
    && yq w -i cert.yaml spec.secretName '${params.namespace}' \
    && yq w -i cert.yaml metadata.namespace '${params.certNamespace}' \
    ${subdomains
      .map(
        (s) => `&& yq w -i cert.yaml spec.dnsNames[+] '${s + params.domain}'`
      )
      .join("  ")} \
    && kubectl apply -f cert.yaml`;

  werft.log("certificate", "Kubectl command for cert creation: " + cmd);
  exec(cmd, { ...shellOpts, slice: "certificate" });

  werft.log(
    "certificate",
    `waiting until certificate ${params.certNamespace}/${params.namespace} is ready...`
  );
  let notReadyYet = true;
  for (let i = 0; i < 90 && notReadyYet; i++) {
    werft.log(
      "certificate",
      `polling state of ${params.certNamespace}/${params.namespace}...`
    );
    const result = exec(
      `kubectl -n ${params.certNamespace} get certificate ${params.namespace} -o jsonpath="{.status.conditions[?(@.type == 'Ready')].status}"`,
      { ...shellOpts, silent: true, dontCheckRc: true, async: false }
    );
    if (result != undefined && result.code === 0 && result.stdout === "True") {
      notReadyYet = false;
      break;
    }

    await sleep(5000);
  }
}

export async function installCertficate(
  werft,
  params: InstallCertificateParams,
  shellOpts: ExecOptions
) {
  let notReadyYet = true;
  werft.log(
    "certificate",
    `copying certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`
  );
  const cmd = `kubectl get secret ${params.certName} --namespace=${params.certNamespace} -o yaml \
    | yq d - 'metadata.namespace' \
    | yq d - 'metadata.uid' \
    | yq d - 'metadata.resourceVersion' \
    | yq d - 'metadata.creationTimestamp' \
    | sed 's/${params.certName}/${params.certSecretName}/g' \
    | kubectl apply --namespace=${params.destinationNamespace} -f -`;

  for (let i = 0; i < 60 && notReadyYet; i++) {
    const result = exec(cmd, {
      ...shellOpts,
      silent: true,
      dontCheckRc: true,
      async: false,
    });
    if (result != undefined && result.code === 0) {
      notReadyYet = false;
      break;
    }
    werft.log(
      "certificate",
      `Could not copy "${params.certNamespace}/${params.certName}", will retry`
    );
    await sleep(5000);
  }
  if (!notReadyYet) {
    werft.log(
      "certificate",
      `copied certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`
    );
    werft.done("certificate");
  } else {
    werft.fail(
      "certificate",
      `failed to copy certificate from "${params.certNamespace}/${params.certName}" to "${params.destinationNamespace}/${params.certSecretName}"`
    );
  }
}
