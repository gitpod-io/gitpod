/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { trackEvent } from "../Analytics";
import SelectIDE from "./SelectIDE";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { ThemeSelector } from "../components/ThemeSelector";
import Alert from "../components/Alert";
import { Link } from "react-router-dom";
import { Heading2, Subheading } from "../components/typography/headings";
import { useUserMaySetTimeout } from "../data/current-user/may-set-timeout-query";
import { Button } from "../components/Button";

export default function Preferences() {
    const { user, setUser } = useContext(UserContext);
    const maySetTimeout = useUserMaySetTimeout();

    const [dotfileRepo, setDotfileRepo] = useState<string>(user?.additionalData?.dotfileRepo || "");
    const [workspaceTimeout, setWorkspaceTimeout] = useState<string>(user?.additionalData?.workspaceTimeout ?? "");

    const saveDotfileRepo = useCallback(
        async (e) => {
            e.preventDefault();

            const prevDotfileRepo = user?.additionalData?.dotfileRepo || "";
            const additionalData = {
                ...(user?.additionalData || {}),
                dotfileRepo,
            };
            const updatedUser = await getGitpodService().server.updateLoggedInUser({ additionalData });
            setUser(updatedUser);

            if (dotfileRepo !== prevDotfileRepo) {
                trackEvent("dotfile_repo_changed", {
                    previous: prevDotfileRepo,
                    current: dotfileRepo,
                });
            }
        },
        [dotfileRepo, setUser, user?.additionalData],
    );

    const saveWorkspaceTimeout = useCallback(
        async (e) => {
            e.preventDefault();

            try {
                await getGitpodService().server.updateWorkspaceTimeoutSetting({ workspaceTimeout: workspaceTimeout });
            } catch (e) {
                alert("Cannot set custom workspace timeout: " + e.message);
            }
        },
        [workspaceTimeout],
    );

    return (
        <div>
            <PageWithSettingsSubMenu>
                <Heading2>Editor</Heading2>
                <Subheading>
                    Choose the editor for opening workspaces.{" "}
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

                <ThemeSelector className="mt-12" />

                <Heading2 className="mt-12">Dotfiles</Heading2>
                <Subheading>Customize workspaces using dotfiles.</Subheading>
                <form className="mt-4 max-w-xl" onSubmit={saveDotfileRepo}>
                    <h4>Repository URL</h4>
                    <span className="flex">
                        <input
                            type="text"
                            value={dotfileRepo}
                            className="w-96 h-9"
                            placeholder="e.g. https://github.com/username/dotfiles"
                            onChange={(e) => setDotfileRepo(e.target.value)}
                        />
                        <Button type="secondary" className="ml-2">
                            Save Changes
                        </Button>
                    </span>
                    <div className="mt-1">
                        <p className="text-gray-500 dark:text-gray-400">
                            Add a repository URL that includes dotfiles. Gitpod will
                            <br />
                            clone and install your dotfiles for every new workspace.
                        </p>
                    </div>
                </form>

                <Heading2 className="mt-12">Timeouts</Heading2>
                <Subheading>Workspaces will stop after a period of inactivity without any user input.</Subheading>
                <div className="mt-4 max-w-xl">
                    <h4>Default Workspace Timeout</h4>

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
                            <span className="flex">
                                <input
                                    type="text"
                                    className="w-96 h-9"
                                    value={workspaceTimeout}
                                    placeholder="e.g. 30m"
                                    onChange={(e) => setWorkspaceTimeout(e.target.value)}
                                />
                                <Button type="secondary" className="ml-2">
                                    Save Changes
                                </Button>
                            </span>
                            <div className="mt-1">
                                <p className="text-gray-500 dark:text-gray-400">
                                    Use minutes or hours, like <span className="font-semibold">30m</span> or{" "}
                                    <span className="font-semibold">2h</span>.
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            </PageWithSettingsSubMenu>
        </div>
    );
}
