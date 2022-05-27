/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import SelectableCardSolid from "../components/SelectableCardSolid";
import { getGitpodService } from "../service/service";
import { ThemeContext } from "../theme-context";
import { UserContext } from "../user-context";
import getSettingsMenu from "./settings-menu";
import { trackEvent } from "../Analytics";
import { PaymentContext } from "../payment-context";
import SelectIDE from "./SelectIDE";

type Theme = "light" | "dark" | "system";

export default function Preferences() {
    const { user } = useContext(UserContext);
    const { showPaymentUI, showUsageBasedUI } = useContext(PaymentContext);
    const { setIsDark } = useContext(ThemeContext);

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

    return (
        <div>
            <PageWithSubMenu
                subMenu={getSettingsMenu({ showPaymentUI, showUsageBasedUI })}
                title="Preferences"
                subtitle="Configure user preferences."
            >
                <h3>Editor</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">Choose the editor for opening workspaces.</p>
                <SelectIDE location="preferences" />
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

                <h3 className="mt-12">
                    Dotfiles{" "}
                    <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">
                        Beta
                    </PillLabel>
                </h3>
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
            </PageWithSubMenu>
        </div>
    );
}
