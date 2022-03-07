import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";
import { JobConfig } from "./job-config";

export async function validateChanges(werft: Werft, config: JobConfig) {
    werft.phase('validate-changes', 'validating changes');
    try {
        branchNameCheck(werft, config)
        preCommitCheck(werft)
    } catch (err) {
        werft.fail('validate-changes', err);
    }
    werft.done('validate-changes');
}

// Branch names cannot be longer than 20 characters.
// We plan to remove this limitation once we move to previews on Harvester VMs.
async function branchNameCheck(werft: Werft, config: JobConfig) {
    if (!config.noPreview) {
        const maxBranchNameLength = 20;
        werft.log("check-branchname", `Checking if branch name is shorter than ${maxBranchNameLength} characters.`)

        if (config.previewEnvironment.destname.length > maxBranchNameLength) {
            throw new Error(`The branch name ${config.previewEnvironment.destname} is more than ${maxBranchNameLength} character. Please choose a shorter name!`)
        }
        werft.done("check-branchname")
    }
}

async function preCommitCheck(werft: Werft) {
    werft.log("pre-commit checks", "Running pre-commit hooks.")
    const preCommitCmd = exec(`pre-commit run --all-files --show-diff-on-failure`, { slice: "pre-commit checks" });

    if (preCommitCmd.code != 0) {
        throw new Error(preCommitCmd.stderr.toString().trim())
    }
    werft.done("pre-commit checks")
}
