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
            </PageWithSettingsSubMenu>
        </div>
    );
}
