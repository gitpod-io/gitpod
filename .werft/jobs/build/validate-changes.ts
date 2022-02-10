import { exec } from "../../util/shell";
import { Werft } from "../../util/werft";

export async function validateChanges(werft: Werft) {
    werft.phase('validate-changes', 'validating changes');
    try {
        exec(`pre-commit run --all-files --show-diff-on-failure`);
        werft.done('validate-changes');
    } catch (err) {
        werft.fail('validate-changes', err);
    }
}
