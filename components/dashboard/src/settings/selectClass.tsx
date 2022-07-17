/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { trackEvent } from "../Analytics";
import { WorkspaceClasses } from "@gitpod/gitpod-protocol";
import WorkspaceClass from "../components/WorkspaceClass";

interface SelectWorkspaceClassProps {
    enabled: boolean;
}

export default function SelectWorkspaceClass(props: SelectWorkspaceClassProps) {
    const { user } = useContext(UserContext);

    const [workspaceClass, setWorkspaceClass] = useState<string>(
        user?.additionalData?.workspaceClasses?.regular || "g1-standard",
    );
    const actuallySetWorkspaceClass = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const prevWorkspaceClass = additionalData?.workspaceClasses?.regular || "g1-standard";
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
                    <WorkspaceClass
                        additionalStyles="w-80 h-32"
                        selected={workspaceClass === "g1-standard"}
                        onClick={() => actuallySetWorkspaceClass("g1-standard")}
                        category="GENERAL PURPOSE"
                        friendlyName="Standard"
                        description="Up to 4 vCPU, 8GB memory, 30GB disk"
                        powerUps={1}
                    />
                    <WorkspaceClass
                        additionalStyles="w-80 h-32"
                        selected={workspaceClass === "g1-large"}
                        onClick={() => actuallySetWorkspaceClass("g1-large")}
                        category="GENERAL PURPOSE"
                        friendlyName="Large"
                        description="Up to 8 vCPU, 16GB memory, 50GB disk"
                        powerUps={2}
                    />
                </div>
            </div>
        );
    }
}
