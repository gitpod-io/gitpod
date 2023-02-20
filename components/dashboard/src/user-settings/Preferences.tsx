/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { trackEvent } from "../Analytics";
import SelectIDE from "./SelectIDE";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { ThemeSelector } from "../components/ThemeSelector";
import CheckBox from "../components/CheckBox";
import { WorkspaceTimeoutDuration } from "@gitpod/gitpod-protocol";

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

    const [disabledClosedTimeout, setDisabledClosedTimeout] = useState<boolean>(
        user?.additionalData?.disabledClosedTimeout ?? false,
    );
    const actuallySetDisabledClosedTimeout = async (value: boolean) => {
        try {
            const additionalData = user?.additionalData || {};
            additionalData.disabledClosedTimeout = value;
            await getGitpodService().server.updateLoggedInUser({ additionalData });
            setDisabledClosedTimeout(value);
        } catch (e) {
            alert("Cannot set custom workspace timeout: " + e.message);
        }
    };

    const [workspaceTimeout, setWorkspaceTimeout] = useState<string>(user?.additionalData?.workspaceTimeout ?? "");
    const actuallySetWorkspaceTimeout = async (value: string) => {
        try {
            const timeout = WorkspaceTimeoutDuration.validate(value);
            const additionalData = user?.additionalData || {};
            additionalData.workspaceTimeout = timeout;
            await getGitpodService().server.updateLoggedInUser({ additionalData });
        } catch (e) {
            alert("Cannot set custom workspace timeout: " + e.message);
        }
    };

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
                    By default, workspaces stop following 30 minutes without user input (e.g. keystrokes or terminal
                    input commands). You can increase the workspace timeout up to a maximum of 24 hours.
                </p>
                <div className="mt-4 max-w-xl">
                    <h4>Default Inactivity Timeout</h4>
                    <span className="flex">
                        <input
                            type="text"
                            className="w-96 h-9"
                            value={workspaceTimeout}
                            placeholder="timeout time, such as 30m, 1h, max 24h"
                            onChange={(e) => setWorkspaceTimeout(e.target.value)}
                        />
                        <button
                            className="secondary ml-2"
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

                    <CheckBox
                        title="Stop workspace when no active editor connection"
                        desc={<span>Don't change workspace inactivity timeout when closing the editor.</span>}
                        checked={disabledClosedTimeout}
                        onChange={(e) => actuallySetDisabledClosedTimeout(e.target.checked)}
                    />
                </div>
            </PageWithSettingsSubMenu>
        </div>
    );
}
