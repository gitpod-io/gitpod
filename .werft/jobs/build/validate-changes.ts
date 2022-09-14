import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

export async function validateChanges(werft: Werft, config: JobConfig) {
    werft.phase("validate-changes", "Validating changes");
    await Promise.all([
        branchNameCheck(werft, config),
        preCommitCheck(werft),
        typecheckWerftJobs(werft)
    ])
}

// Branch names cannot be longer than 45 characters.
//
// The branch name is used as part of the Werft job name. The job name is used for the name of the pod
// and k8s has a limit of 63 characters. We use 13 characters for the "gitpod-build-" prefix and 5
// more for the ".<BUILD NUMBER>" ending. That leaves us 45 characters for the branch name.
// See Werft source https://github.com/csweichel/werft/blob/057cfae0fd7bb1a7b05f89d1b162348378d74e71/pkg/werft/service.go#L376
async function branchNameCheck(werft: Werft, config: JobConfig) {
    const maxBranchNameLength = 45;
    if (config.withPreview) {
        const slice = "check-branchname"
        werft.log(slice, `Checking if branch name is shorter than ${maxBranchNameLength} characters.`);
        if (config.previewEnvironment.destname.length > maxBranchNameLength) {
            werft.fail(slice, new Error(`The branch name ${config.previewEnvironment.destname} is more than ${maxBranchNameLength} character. Please choose a shorter name!`))
        }
        werft.done(slice);
    }
}

async function preCommitCheck(werft: Werft) {
    const slice = 'pre-commit checks'
    try {
        werft.log(slice, "Running pre-commit hooks");
        await exec(`pre-commit run --show-diff-on-failure`, { slice, async: true });
        werft.log(slice, "pre-commit hooks succeeded");
    } catch (e) {
        werft.fail(slice, e)
    }
    werft.done(slice);
}

/**
 * This validates all the .ts files inside of the .werft folder and fails the
 * build if there are compile errors.
 */
async function typecheckWerftJobs(werft: Werft) {
    const slice = "tsc --noEmit";
    try {
        werft.log(slice, "Type checking TypeScript files");
        await exec("cd .werft && tsc --noEmit", { slice, async: true });
        werft.log(slice, "No compilation errors.");
    } catch (e) {
        werft.fail(slice, e);
    }
    werft.done(slice);
}
