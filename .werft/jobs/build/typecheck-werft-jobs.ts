import { Werft } from "../../util/werft";
import { exec } from "../../util/shell";

/**
 * This validates all the .ts files inside of the .werft folder and fails the
 * build if there are compile errors.
 */
export async function typecheckWerftJobs(werft: Werft) {
    werft.phase("Typecheck Typescript Werft files", "Typechecking Werft Typescript files");
    const slice = "tsc --noEmit";
    try {
        exec("cd .werft && tsc --noEmit", { slice });
        werft.log(slice, "No compilation errors.");
    } catch (e) {
        werft.fail(slice, e);
    }
    werft.done(slice);
}
