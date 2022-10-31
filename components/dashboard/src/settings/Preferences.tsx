/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import SelectableCardSolid from "../components/SelectableCardSolid";
import { getGitpodService } from "../service/service";
import { ThemeContext } from "../theme-context";
import { UserContext } from "../user-context";
import SelectIDE from "./SelectIDE";
import SelectWorkspaceClass from "./selectClass";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import CheckBox from "../components/CheckBox";
import { AdditionalUserData } from "@gitpod/gitpod-protocol";

type Theme = "light" | "dark" | "system";

export default function Preferences() {
    const { user, userBillingMode, setUser } = useContext(UserContext);
    const { setIsDark } = useContext(ThemeContext);

    const updateAdditionalData = async (value: Partial<AdditionalUserData>) => {
        if (!user) {
            return;
        }
        const newAdditionalData = {
            ...user?.additionalData,
            ...value,
        };
        user.additionalData = newAdditionalData;
        setUser({ ...user });
        await getGitpodService().server.updateLoggedInUser(user);
    };
    const [dotfileRepo, setDotfileRepo] = useState<string>(user?.additionalData?.dotfileRepo || "");
    const [theme, setTheme] = useState<Theme>(localStorage.theme || "system");
    const actuallySetTheme = (theme: Theme) => {
        if (theme === "dark" || theme === "light") {
            localStorage.theme = theme;
        } else {
            localStorage.removeItem("theme");
        }
        const isDark =
            localStorage.theme === "dark" ||
            (localStorage.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        setIsDark(isDark);
        setTheme(theme);
    };

    return (
        <div>
            <PageWithSettingsSubMenu title="Preferences" subtitle="Configure user preferences.">
                <h3>Editor</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">Choose the editor for opening workspaces.</p>
                <SelectIDE location="preferences" />
                <h3 className="mt-12">Workspaces</h3>
                <SelectWorkspaceClass enabled={BillingMode.canSetWorkspaceClass(userBillingMode)} />
                <CheckBox
                    title="Never wait for running prebuilds"
                    desc={
                        <span>
                            Whether to ignore any still running prebuilds when starting a fresh workspace. Enabling this
                            will skip the prebuild is running dialog on workspace starts and start a workspace without a
                            prebuild or based on a previous prebuild if enabled (see below).
                        </span>
                    }
                    checked={!!user?.additionalData?.ignoreRunnningPrebuilds}
                    onChange={(e) => updateAdditionalData({ ignoreRunnningPrebuilds: e.target.checked })}
                />
                <CheckBox
                    title="Allow incremental workspaces"
                    desc={
                        <span>
                            Whether new workspaces can be started based on prebuilds that ran on older Git commits and
                            get incrementally updated.
                        </span>
                    }
                    checked={!!user?.additionalData?.allowUsingPreviousPrebuilds}
                    onChange={(e) => updateAdditionalData({ allowUsingPreviousPrebuilds: e.target.checked })}
                />
                <CheckBox
                    title="Never ask when there are running workspaces on the same commit"
                    desc={
                        <span>
                            Whether to ignore any running workspaces on the same commit, when starting a fresh
                            workspace. Enabling this will skip the dialog about already running workspaces when starting
                            a fresh workspace and always default to creating a fresh one.
                        </span>
                    }
                    checked={!!user?.additionalData?.ignoreRunningWorkspaceOnSameCommit}
                    onChange={(e) => updateAdditionalData({ ignoreRunningWorkspaceOnSameCommit: e.target.checked })}
                />
                <h3 className="mt-12">Theme</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">Early bird or night owl? Choose your side.</p>
                <div className="mt-4 space-x-3 flex">
                    <SelectableCardSolid
                        className="w-36 h-32"
                        title="Light"
                        selected={theme === "light"}
                        onClick={() => actuallySetTheme("light")}
                    >
                        <div className="flex-grow flex items-end p-1">
                            <svg width="112" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M0 8a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 32a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 56a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM40 6a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V6Z"
                                    fill="#D6D3D1"
                                />
                            </svg>
                        </div>
                    </SelectableCardSolid>
                    <SelectableCardSolid
                        className="w-36 h-32"
                        title="Dark"
                        selected={theme === "dark"}
                        onClick={() => actuallySetTheme("dark")}
                    >
                        <div className="flex-grow flex items-end p-1">
                            <svg width="112" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M0 8a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 32a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 56a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM40 6a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V6Z"
                                    fill="#78716C"
                                />
                            </svg>
                        </div>
                    </SelectableCardSolid>
                    <SelectableCardSolid
                        className="w-36 h-32"
                        title="System"
                        selected={theme === "system"}
                        onClick={() => actuallySetTheme("system")}
                    >
                        <div className="flex-grow flex items-end p-1">
                            <svg width="112" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M0 8a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM40 6a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V6Z"
                                    fill="#D9D9D9"
                                />
                                <path
                                    d="M84 0h22a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H68L84 0ZM0 32a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8Z"
                                    fill="#78716C"
                                />
                                <path d="M0 56a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8Z" fill="#D9D9D9" />
                            </svg>
                        </div>
                    </SelectableCardSolid>
                </div>

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
                        <button className="secondary ml-2" onClick={() => updateAdditionalData({ dotfileRepo })}>
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
            </PageWithSettingsSubMenu>
        </div>
    );
}
