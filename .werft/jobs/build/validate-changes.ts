import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

export async function validateChanges(werft: Werft, config: JobConfig) {
    werft.phase("validate-changes", "validating changes");
    // We run pre-commit checks first to avoid potential race conditions with the
    // other validation checks.
    await preCommitCheck(werft);
    await Promise.all([
        branchNameCheck(werft, config),
        typecheckWerftJobs(werft),
        leewayVet(werft),
    ]);
}

// Branch names cannot be longer than 45 characters.
//
// The branch name is used as part of the Werft job name. The job name is used for the name of the pod
// and k8s has a limit of 63 characters. We use 13 characters for the "gitpod-build-" prefix and 5
// more for the ".<BUILD NUMBER>" ending. That leaves us 45 characters for the branch name.
// See Werft source https://github.com/csweichel/werft/blob/057cfae0fd7bb1a7b05f89d1b162348378d74e71/pkg/werft/service.go#L376
async function branchNameCheck(werft: Werft, config: JobConfig) {
    if (config.withPreview) {
        const maxBranchNameLength = 45;
        werft.log("check-branchname", `Checking if branch name is shorter than ${maxBranchNameLength} characters.`);

        if (config.previewEnvironment.destname.length > maxBranchNameLength) {
            throw new Error(
                `The branch name ${config.previewEnvironment.destname} is more than ${maxBranchNameLength} character. Please choose a shorter name!`,
            );
        }
        werft.done("check-branchname");
    }
}

async function preCommitCheck(werft: Werft) {
    werft.log("pre-commit checks", "Running pre-commit hooks.");
    const preCommitCmd = await exec(`pre-commit run --show-diff-on-failure`, {
        slice: "pre-commit checks",
        async: true,
    });

    if (preCommitCmd.code != 0) {
        throw new Error(preCommitCmd.stderr.toString().trim());
    }
    werft.done("pre-commit checks");
}

/**
 * This validates all the .ts files inside of the .werft folder and fails the
 * build if there are compile errors.
 */
export async function typecheckWerftJobs(werft: Werft) {
    const slice = "tsc --noEmit";
    try {
        werft.log(slice, "Typechecking Werft Typescript files");
        await exec("cd .werft && tsc --noEmit", { slice, async: true });
        werft.log(slice, "No compilation errors");
    } catch (e) {
        werft.fail(slice, e);
    }
    werft.done(slice);
}

export async function leewayVet(werft: Werft) {
    const slice = "leeway vet --ignore-warnings"
    try {
        werft.log(slice, "Running leeway vet")
        await exec(`leeway vet --ignore-warnings`, {slice, async: true});
        werft.log(slice, "leeway vet successful")
    } catch (e) {
        werft.fail(slice, e)
    }
    werft.done(slice);
}
