/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useState } from "react";
import { UserContext } from "../user-context";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { ThemeSelector } from "../components/ThemeSelector";
import { Link } from "react-router-dom";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { Button } from "../components/Button";
import SelectIDE from "./SelectIDE";
import { InputField } from "../components/forms/InputField";
import { TextInput } from "../components/forms/TextInputField";
import { useToast } from "../components/toasts/Toasts";
import {
    useResetWorkspaceAutoStartOptionsMutation,
    useUpdateCurrentUserDotfileRepoMutation,
    useUpdateWorkspaceTimeoutMutation,
} from "../data/current-user/update-mutation";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { converter } from "../service/public-api";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";

export default function Preferences() {
    const { toast } = useToast();
    const { user, setUser } = useContext(UserContext);
    const resetWorkspaceAutoStartOptions = useResetWorkspaceAutoStartOptionsMutation();
    const updateDotfileRepo = useUpdateCurrentUserDotfileRepoMutation();
    const updateWorkspaceTimeout = useUpdateWorkspaceTimeoutMutation();
    const billingMode = useOrgBillingMode();

    const [dotfileRepo, setDotfileRepo] = useState<string>(user?.dotfileRepo || "");

    const [workspaceTimeout, setWorkspaceTimeout] = useState<string>(
        converter.toDurationString(user?.workspaceTimeoutSettings?.inactivity),
    );
    const [timeoutUpdating, setTimeoutUpdating] = useState(false);
    const [creationError, setCreationError] = useState<Error>();

    const saveDotfileRepo = useCallback(
        async (e) => {
            e.preventDefault();

            const user = await updateDotfileRepo.mutateAsync(dotfileRepo);
            if (user) {
                setUser(user);
            }
            toast("Your dotfiles repository was updated.");
        },
        [updateDotfileRepo, dotfileRepo, setUser, toast],
    );

    const saveWorkspaceTimeout = useCallback(
        async (e) => {
            e.preventDefault();
            setTimeoutUpdating(true);

            try {
                const updatedUser = await updateWorkspaceTimeout.mutateAsync(workspaceTimeout);
                if (updatedUser) {
                    setUser(updatedUser);
                }

                let toastMessage = <>Default workspace timeout was updated.</>;
                if (billingMode.data?.mode === "usage-based") {
                    if (!billingMode.data.paid) {
                        toastMessage = (
                            <>
                                {toastMessage} Changes will only affect workspaces in paid organizations. Go to{" "}
                                <Link to="/billing" className="gp-link">
                                    billing
                                </Link>{" "}
                                to upgrade your organization.
                            </>
                        );
                    }
                }
                // Reset creationError to avoid displaying the error message and toast the success message
                setCreationError(undefined);
                toast(toastMessage);
            } catch (e) {
                setCreationError(new Error(e.message));
            } finally {
                setTimeoutUpdating(false);
            }
        },
        [toast, setUser, workspaceTimeout, billingMode, updateWorkspaceTimeout],
    );

    const clearCreateWorkspaceOptions = useCallback(async () => {
        if (!user) {
            return;
        }
        const updatedUser = await resetWorkspaceAutoStartOptions.mutateAsync();
        if (updatedUser) {
            setUser(updatedUser);
        }
        toast("Workspace options have been cleared.");
    }, [resetWorkspaceAutoStartOptions, setUser, toast, user]);

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
                <Heading3 className="mt-12">Workspace Options</Heading3>
                <Subheading>Clear last used options for creating workspaces.</Subheading>
                <Button className="mt-4" type="secondary" onClick={clearCreateWorkspaceOptions}>
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
                                disabled={updateDotfileRepo.isLoading || (dotfileRepo === user?.dotfileRepo ?? "")}
                            >
                                Save
                            </Button>
                        </div>
                    </InputField>
                </form>

                <Heading2 className="mt-12">Timeouts</Heading2>
                <Subheading>Workspaces will stop after a period of inactivity without any user input.</Subheading>

                <div className="mt-4 max-w-xl">
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
                            <div className="flex flex-col">
                                <div className="flex items-center space-x-2 mb-2">
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
                                        disabled={
                                            workspaceTimeout ===
                                                converter.toDurationString(
                                                    user?.workspaceTimeoutSettings?.inactivity,
                                                ) ?? ""
                                        }
                                    >
                                        Save
                                    </Button>
                                </div>
                                {!!creationError && (
                                    <p className="text-gitpod-red w-full max-w-lg">
                                        Cannot set custom workspace timeout: {creationError.message}
                                    </p>
                                )}
                            </div>
                        </InputField>
                    </form>
                </div>
            </PageWithSettingsSubMenu>
        </div>
    );
}
