/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import SelectableCardSolid from "../components/SelectableCardSolid";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { trackEvent } from "../Analytics";
import { WorkspaceClasses } from "@gitpod/gitpod-protocol";

interface SelectWorkspaceClassProps {
    enabled: boolean;
}

export default function SelectWorkspaceClass(props: SelectWorkspaceClassProps) {
    const { user } = useContext(UserContext);

    const [workspaceClass, setWorkspaceClass] = useState<string>(
        user?.additionalData?.workspaceClasses?.regular || "standard",
    );
    const actuallySetWorkspaceClass = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const prevWorkspaceClass = additionalData?.workspaceClasses?.regular || "standard";
        const workspaceClasses = (additionalData?.workspaceClasses || {}) as WorkspaceClasses;
        workspaceClasses.regular = value;
        workspaceClasses.prebuild = value;
        additionalData.workspaceClasses = workspaceClasses;
        if (value !== prevWorkspaceClass) {
            await getGitpodService().server.updateLoggedInUser({ additionalData });
            trackEvent("workspace_class_changed", {
                previous: prevWorkspaceClass,
                current: value,
            });
            setWorkspaceClass(value);
        }
    };

    if (!props.enabled) {
        return <div></div>;
    } else {
        return (
            <div>
                <h3 className="mt-12">Workspaces</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">
                    Choose the workspace machine type for your workspaces.
                </p>
                <div className="mt-4 space-x-3 flex">
                    <SelectableCardSolid
                        className="w-36 h-32"
                        title="Standard"
                        selected={workspaceClass === "standard"}
                        onClick={() => actuallySetWorkspaceClass("standard")}
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
                        title="XL"
                        selected={workspaceClass === "XL"}
                        onClick={() => actuallySetWorkspaceClass("XL")}
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
            </div>
        );
    }
}
