import { createHash } from "crypto";
import { PREVIEW_K3S_KUBECONFIG_PATH } from "../jobs/build/const";
import * as VM from "../vm/vm";
import { exec } from "./shell";
import { Werft } from "./werft";

/**
 * Based on the current branch name this will compute the name of the associated
 * preview environment.
 *
 * NOTE: This needs to produce the same result as the function in dev/preview/util/preview-name-from-branch.sh
 */
export function previewNameFromBranchName(branchName: string): string {
    // Due to various limitations we have to ensure that we only use 20 characters
    // for the preview environment name.
    //
    // If the branch name is 20 characters or less we just use it.
    //
    // Otherwise:
    //
    // We use the first 10 chars of the sanitized branch name
    // and then the 10 first chars of the hash of the sanitized branch name
    //
    // That means collisions can happen. If they do, two jobs would try to deploy to the same
    // environment.
    //
    // see https://github.com/gitpod-io/ops/issues/1252 for details.
    const sanitizedBranchName = branchName
        .replace(/^refs\/heads\//, "")
        .toLocaleLowerCase()
        .replace(/[^-a-z0-9]/g, "-");

    if (sanitizedBranchName.length <= 20) {
        return sanitizedBranchName;
    }

    const hashed = createHash("sha256").update(sanitizedBranchName).digest("hex");
    return `${sanitizedBranchName.substring(0, 10)}${hashed.substring(0, 10)}`;
}

export class HarvesterPreviewEnvironment {
    // The prefix we use for the namespace
    static readonly namespacePrefix: string = "preview-";

    // The name of the namespace that the VM and related resources are in, e.g. preview-my-branch
    namespace: string;

    // The name of the preview environment, e.g. my-branch
    name: string;

    werft: Werft;

    // The namespace in the k3s cluster where all resources are (default)
    k3sNamespace: string = "default";

    constructor(werft: Werft, namespace: string) {
        this.werft = werft;
        this.namespace = namespace;
        this.name = namespace.replace(HarvesterPreviewEnvironment.namespacePrefix, "");
    }

    async delete(): Promise<void> {
        VM.deleteVM({ name: this.name });
    }

    /**
     * Checks whether a preview environment is active based on the db activity.
     *
     * It errs on the side of caution, so in case of connection issues etc. it will consider the
     * preview environment active.
     */
    isActive(sliceID: string): boolean {
        try {
            try {
                VM.get({ name: this.name });
            } catch (e) {
                if (e instanceof VM.NotFoundError) {
                    this.werft.log(
                        sliceID,
                        `${this.name} - is-active=false - The VM doesn't exist, deleting the environment`,
                    );
                    return false;
                }
                this.werft.log(
                    sliceID,
                    `${this.name} - is-active=true - Unexpected error trying to get the VM. Marking env as active: ${e.message}`,
                );
                return true;
            }

            VM.copyk3sKubeconfigShell({ name: this.name, timeoutMS: 1000 * 60 * 3, slice: sliceID });
            const kubectclCmd = `KUBECONFIG=${PREVIEW_K3S_KUBECONFIG_PATH} kubectl --insecure-skip-tls-verify`;

            this.werft.log(sliceID, `${this.name} (${this.k3sNamespace}) - Checking status of the MySQL pod`);
            const statusDB = exec(
                `${kubectclCmd} get pods mysql-0 -n ${this.k3sNamespace} -o jsonpath='{.status.phase}'`,
                { slice: sliceID, dontCheckRc: true },
            );
            const statusDbContainer = exec(
                `${kubectclCmd} get pods mysql-0 -n ${this.k3sNamespace} -o jsonpath='{.status.containerStatuses.*.ready}'`,
                { slice: sliceID, dontCheckRc: true },
            );

            if (statusDB.code != 0 || statusDB != "Running" || statusDbContainer == "false") {
                this.werft.log(
                    sliceID,
                    `${this.name} (${this.k3sNamespace}) - is-active=false - The database is not reachable, assuming env is not active`,
                );
                VM.stopKubectlPortForwards();
                exec(`rm ${PREVIEW_K3S_KUBECONFIG_PATH}`, { silent: true, slice: sliceID });
                return false;
            }

            const dbPassword = exec(
                `${kubectclCmd} get secret db-password -n ${this.k3sNamespace} -o jsonpath='{.data.mysql-root-password}' | base64 -d`,
                { silent: true },
            ).stdout.trim();

            // MySQL runs in the preview env cluster that is not reachable form the job's pod, so we have to port forward
            exec(`${kubectclCmd} -n ${this.k3sNamespace} port-forward svc/mysql 33061:3306`, {
                async: true,
                silent: true,
                slice: sliceID,
                dontCheckRc: true,
            });
            exec("sleep 5", { silent: true, slice: sliceID });

            // Using MYSQL_PWD instead of a flag for the pwd suppresses "[Warning] Using a password on the command line interface can be insecure."
            const dbConn = `MYSQL_PWD=${dbPassword} mysql --host=127.0.0.1 --port=33061 --user=root --database=gitpod -s -N`;
            const active = this.isDbActive(dbConn, sliceID);

            // clean after ourselves, as we'll be running this for quite a few environments
            VM.stopKubectlPortForwards();
            exec(`rm ${PREVIEW_K3S_KUBECONFIG_PATH}`, { silent: true, slice: sliceID });

            return active;
        } catch (err) {
            // cleanup in case of an error
            VM.stopKubectlPortForwards();
            exec(`rm ${PREVIEW_K3S_KUBECONFIG_PATH}`, { silent: true, slice: sliceID });
            this.werft.log(
                sliceID,
                `${this.name} (${this.k3sNamespace}) - is-active=true - Unable to check DB activity, assuming env is active`,
            );
            return true;
        }
    }

    /**
     * Determines if the db of a preview environment is active
     * by looking if there were relevant entries in the workspace and user tables in the last 48h
     *
     */
    private isDbActive(dbConn: string, sliceID: string): boolean {
        const timeout = 48;
        let isActive = false;

        const queries = {
            d_b_workspace_instance: `SELECT TIMESTAMPDIFF(HOUR, creationTime, NOW()) FROM d_b_workspace_instance WHERE creationTime > DATE_SUB(NOW(), INTERVAL '${timeout}' HOUR) ORDER BY creationTime DESC LIMIT 1`,
            "d_b_user-created": `SELECT TIMESTAMPDIFF(HOUR, creationDate, NOW()) FROM d_b_user WHERE creationDate > DATE_SUB(NOW(), INTERVAL '${timeout}' HOUR) ORDER BY creationDate DESC LIMIT 1`,
            "d_b_user-modified": `SELECT TIMESTAMPDIFF(HOUR, _lastModified, NOW()) FROM d_b_user WHERE _lastModified > DATE_SUB(NOW(), INTERVAL '${timeout}' HOUR) ORDER BY _lastModified DESC LIMIT 1`,
            d_b_workspace_instance_user: `SELECT TIMESTAMPDIFF(HOUR, lastSeen, NOW()) FROM d_b_workspace_instance_user WHERE lastSeen > DATE_SUB(NOW(), INTERVAL '${timeout}' HOUR) ORDER BY lastSeen DESC LIMIT 1`,
        };

        const result = {};
        // let logLine = `Last Activity (hours ago):`
        for (const [key, query] of Object.entries(queries)) {
            // explicitly set to null, so we get an output in the logs for those queries
            result[key] = null;
            const queryResult = exec(`${dbConn} --execute="${query}"`, { silent: true, slice: sliceID });
            if (queryResult.length > 0) {
                result[key] = queryResult.stdout.trim();
                isActive = true;
            }
        }

        const logLines = Object.entries(result).map((kv) => `${kv.join(":")}`);
        const logLine = `Last Activity (hours ago): ${logLines.join(",")}`;

        this.werft.log(sliceID, `${this.name} (${this.namespace}) - is-active=${isActive} ${logLine}`);

        return isActive;
    }

    /**
     * Given a branch name it will return the expected namespace of the preview environment
     */
    static expectedNamespaceFromBranch(branch: string): string {
        const previewName = previewNameFromBranchName(branch);
        return `${HarvesterPreviewEnvironment.namespacePrefix}${previewName}`;
    }
}

export type PreviewEnvironment = HarvesterPreviewEnvironment;
