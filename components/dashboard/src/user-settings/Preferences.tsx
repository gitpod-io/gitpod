/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { trackEvent } from "../Analytics";
import SelectIDE from "./SelectIDE";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { ThemeSelector } from "../components/ThemeSelector";
import Alert from "../components/Alert";
import { Link } from "react-router-dom";

export default function Preferences() {
    const { user } = useContext(UserContext);

    const [dotfileRepo, setDotfileRepo] = useState<string>(user?.additionalData?.dotfileRepo || "");
    const actuallySetDotfileRepo = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const prevDotfileRepo = additionalData.dotfileRepo || "";
        additionalData.dotfileRepo = value;
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        if (value !== prevDotfileRepo) {
            trackEvent("dotfile_repo_changed", {
                previous: prevDotfileRepo,
                current: value,
            });
        }
    };

    const [workspaceTimeout, setWorkspaceTimeout] = useState<string>(user?.additionalData?.workspaceTimeout ?? "");
    const actuallySetWorkspaceTimeout = useCallback(async (value: string) => {
        try {
            await getGitpodService().server.updateWorkspaceTimeoutSetting({ workspaceTimeout: value });
        } catch (e) {
            alert("Cannot set custom workspace timeout: " + e.message);
        }
    }, []);

    const [allowConfigureWorkspaceTimeout, setAllowConfigureWorkspaceTimeout] = useState<boolean>(false);
    useEffect(() => {
        getGitpodService()
            .server.maySetTimeout()
            .then((r) => setAllowConfigureWorkspaceTimeout(r));
    }, []);

    return (
        <div>
            <PageWithSettingsSubMenu>
                <h3>Editor</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">
                    Choose the editor for opening workspaces.{" "}
                    <a
                        className="gp-link"
                        href="https://www.gitpod.io/docs/references/ides-and-editors"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Learn more
                    </a>
                </p>
                <SelectIDE location="preferences" />

                <ThemeSelector className="mt-12" />

                <h3 className="mt-12">Dotfiles </h3>
                <p className="text-base text-gray-500 dark:text-gray-400">Customize workspaces using dotfiles.</p>
                <div className="mt-4 max-w-xl">
                    <h4>Repository URL</h4>
                    <span className="flex">
                        <input
                            type="text"
                            value={dotfileRepo}
                            className="w-96 h-9"
                            placeholder="e.g. https://github.com/username/dotfiles"
                            onChange={(e) => setDotfileRepo(e.target.value)}
                        />
                        <button className="secondary ml-2" onClick={() => actuallySetDotfileRepo(dotfileRepo)}>
                            Save Changes
                        </button>
                    </span>
                    <div className="mt-1">
                        <p className="text-gray-500 dark:text-gray-400">
                            Add a repository URL that includes dotfiles. Gitpod will
                            <br />
                            clone and install your dotfiles for every new workspace.
                        </p>
                    </div>
                </div>

                <h3 className="mt-12">Inactivity Timeout </h3>
                <p className="text-base text-gray-500 dark:text-gray-400">
                    Workspaces will stop after a period of inactivity without any user input.
                </p>
                <div className="mt-4 max-w-xl">
                    <h4>Default Workspace Timeout</h4>

                    {!allowConfigureWorkspaceTimeout && (
                        <Alert type="message">
                            Upgrade organization <Link to="/billing">billing</Link> plan to use a custom inactivity
                            timeout.
                        </Alert>
                    )}

                    {allowConfigureWorkspaceTimeout && (
                        <>
                            <span className="flex mt-2">
                                <input
                                    type="text"
                                    className="w-96 h-9"
                                    value={workspaceTimeout}
                                    disabled={!allowConfigureWorkspaceTimeout}
                                    placeholder="e.g. 30m"
                                    onChange={(e) => setWorkspaceTimeout(e.target.value)}
                                />
                                <button
                                    className="secondary ml-2"
                                    disabled={!allowConfigureWorkspaceTimeout}
                                    onClick={() => actuallySetWorkspaceTimeout(workspaceTimeout)}
                                >
                                    Save Changes
                                </button>
                            </span>
                            <div className="mt-1">
                                <p className="text-gray-500 dark:text-gray-400">
                                    Use minutes or hours, like <strong>30m</strong> or <strong>2h</strong>.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </PageWithSettingsSubMenu>
        </div>
    );
}
