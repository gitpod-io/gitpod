/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { ThemeSelector } from "../components/ThemeSelector";
import Alert from "../components/Alert";
import { Link } from "react-router-dom";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { useMaySetTimeout } from "../data/current-user/may-set-timeout-query";
import { Button } from "../components/Button";
import SelectIDE from "./SelectIDE";
import { InputField } from "../components/forms/InputField";
import { TextInput } from "../components/forms/TextInputField";
import { useToast } from "../components/toasts/Toasts";
import { useUpdateCurrentUserDotfileRepoMutation } from "../data/current-user/update-mutation";
import { AdditionalUserData } from "@gitpod/gitpod-protocol";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";

export default function Preferences() {
    const { toast } = useToast();
    const { user, setUser } = useContext(UserContext);
    const maySetTimeout = useMaySetTimeout();
    const updateDotfileRepo = useUpdateCurrentUserDotfileRepoMutation();

    const [dotfileRepo, setDotfileRepo] = useState<string>(user?.additionalData?.dotfileRepo || "");
    const [workspaceTimeout, setWorkspaceTimeout] = useState<string>(user?.additionalData?.workspaceTimeout ?? "");
    const [timeoutUpdating, setTimeoutUpdating] = useState(false);

    const saveDotfileRepo = useCallback(
        async (e) => {
            e.preventDefault();

            const updatedUser = await updateDotfileRepo.mutateAsync(dotfileRepo);
            setUser(updatedUser);
            toast("Your dotfiles repository was updated.");
        },
        [updateDotfileRepo, dotfileRepo, setUser, toast],
    );

    const saveWorkspaceTimeout = useCallback(
        async (e) => {
            e.preventDefault();
            setTimeoutUpdating(true);

            // TODO: Convert this to a mutation
            try {
                await getGitpodService().server.updateWorkspaceTimeoutSetting({ workspaceTimeout: workspaceTimeout });

                // TODO: Once current user is in react-query, we can instead invalidate the query vs. refetching here
                const updatedUser = await getGitpodService().server.getLoggedInUser();
                setUser(updatedUser);

                toast(
                    "Your default workspace timeout was updated. Note that this will only affect workspaces in paid organizations.",
                );
            } catch (e) {
                // TODO: Convert this to an error style toast
                alert("Cannot set custom workspace timeout: " + e.message);
            } finally {
                setTimeoutUpdating(false);
            }
        },
        [toast, setUser, workspaceTimeout],
    );

    const clearAutostartWorkspaceOptions = useCallback(async () => {
        if (!user) {
            return;
        }
        AdditionalUserData.set(user, { workspaceAutostartOptions: [] });
        setUser(user);
        await getGitpodService().server.updateLoggedInUser(user);
        toast("Your autostart options were cleared.");
    }, [setUser, toast, user]);

    return (
        <div>
            <PageWithSettingsSubMenu>
                <Heading2>New Workspaces</Heading2>
                <Subheading>
                    Choose your default editor.{" "}
                    <a
                        className="gp-link"
                        href="https://www.gitpod.io/docs/references/ides-and-editors"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Learn more
                    </a>
                </Subheading>
                <SelectIDE location="preferences" />
                <Heading3 className="mt-12">Autostart Options</Heading3>
                <Subheading>Forget any saved autostart options for all repositories.</Subheading>
                <Button className="mt-4" type="secondary" onClick={clearAutostartWorkspaceOptions}>
                    Reset Options
                </Button>

                <ThemeSelector className="mt-12" />

                <Heading2 className="mt-12">Dotfiles</Heading2>
                <Subheading>Customize workspaces using dotfiles.</Subheading>

                <form className="mt-4 max-w-xl" onSubmit={saveDotfileRepo}>
                    <InputField
                        label="Repository URL"
                        hint="Add a repository URL that includes dotfiles. Gitpod will clone and install your dotfiles for every new workspace."
                    >
                        <div className="flex space-x-2">
                            <div className="flex-grow">
                                <TextInput
                                    value={dotfileRepo}
                                    placeholder="e.g. https://github.com/username/dotfiles"
                                    onChange={setDotfileRepo}
                                />
                            </div>
                            <Button
                                htmlType="submit"
                                loading={updateDotfileRepo.isLoading}
                                disabled={
                                    updateDotfileRepo.isLoading ||
                                    (dotfileRepo === user?.additionalData?.dotfileRepo ?? "")
                                }
                            >
                                Save
                            </Button>
                        </div>
                    </InputField>
                </form>

                <Heading2 className="mt-12">Timeouts</Heading2>
                <Subheading>Workspaces will stop after a period of inactivity without any user input.</Subheading>

                <div className="mt-4 max-w-xl">
                    {!maySetTimeout.isLoading && maySetTimeout.data === false && (
                        <Alert type="message">
                            Upgrade organization{" "}
                            <Link to="/billing" className="gp-link">
                                billing
                            </Link>{" "}
                            plan to use a custom inactivity timeout.
                        </Alert>
                    )}

                    {maySetTimeout.data === true && (
                        <form onSubmit={saveWorkspaceTimeout}>
                            <InputField
                                label="Default Workspace Timeout"
                                hint={
                                    <span>
                                        Use minutes or hours, like <span className="font-semibold">30m</span> or{" "}
                                        <span className="font-semibold">2h</span>
                                    </span>
                                }
                            >
                                <div className="flex space-x-2">
                                    <div className="flex-grow">
                                        <TextInput
                                            value={workspaceTimeout}
                                            placeholder="e.g. 30m"
                                            onChange={setWorkspaceTimeout}
                                        />
                                    </div>
                                    <Button
                                        htmlType="submit"
                                        loading={timeoutUpdating}
                                        disabled={workspaceTimeout === user?.additionalData?.workspaceTimeout ?? ""}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </InputField>
                        </form>
                    )}
                </div>
            </PageWithSettingsSubMenu>
        </div>
    );
}
