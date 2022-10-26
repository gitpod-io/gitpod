import {exec} from "./shell";
import {
    CORE_DEV_KUBECONFIG_PATH,
} from "../jobs/build/const";
import { Werft } from "./werft";
import { reportCertificateError } from "../util/slack";
import {JobConfig} from "../jobs/build/job-config";

export async function certReady(werft: Werft, config: JobConfig, slice: string): Promise<boolean> {
    const certName = `harvester-${config.previewEnvironment.destname}`;
    if (isCertReady(certName)){
        werft.log(slice, `Certificate ready`);
        return true
    }

    const certReady = waitCertReady(certName)

    if (!certReady) {
        retrieveFailedCertDebug(certName, slice)
        werft.fail(slice, `Certificate ${certName} never reached the Ready state`)
    }

    return certReady
}

function waitCertReady(certName: string): boolean {
    const timeout = "500s"
    const rc = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} wait --for=condition=Ready --timeout=${timeout} -n certs certificate ${certName}`,
        { dontCheckRc: true },
    ).code
    return rc == 0
}

function isCertReady(certName: string): boolean {
    const output = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n certs get certificate ${certName} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'`,
        { dontCheckRc: true }
    ).stdout.trim();

    return output == "True";
}

function retrieveFailedCertDebug(certName: string, slice: string) {
    const certificateYAML = exec(
        `kubectl --kubeconfig ${CORE_DEV_KUBECONFIG_PATH} -n certs get certificate ${certName} -o yaml`,
        { silent: true },
    ).stdout.trim();
    const certificateDebug = exec(`KUBECONFIG=${CORE_DEV_KUBECONFIG_PATH} cmctl status certificate ${certName} -n certs`);

    reportCertificateError({ certificateName: certName, certifiateYAML: certificateYAML, certificateDebug: certificateDebug }).catch((error: Error) =>
        console.error("Failed to send message to Slack", error),
    );
}
