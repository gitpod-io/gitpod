import { createHash } from "crypto";

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
    const sanitizedBranchName = branchName.replace(/^refs\/heads\//, "").toLocaleLowerCase().replace(/[^-a-z0-9]/g, "-")

    if (sanitizedBranchName.length <= 20) {
        return sanitizedBranchName
    }

    const hashed = createHash('sha256').update(sanitizedBranchName).digest('hex')
    return `${sanitizedBranchName.substring(0, 10)}${hashed.substring(0,10)}`
}
