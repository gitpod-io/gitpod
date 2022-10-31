/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { trackEvent } from "../Analytics";
import { WorkspaceClasses } from "@gitpod/gitpod-protocol";
import WorkspaceClass from "../components/WorkspaceClass";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";

interface SelectWorkspaceClassProps {
    enabled: boolean;
}

export default function SelectWorkspaceClass(props: SelectWorkspaceClassProps) {
    const { user } = useContext(UserContext);

    const [workspaceClass, setWorkspaceClass] = useState<string>(user?.additionalData?.workspaceClasses?.regular || "");
    const actuallySetWorkspaceClass = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const prevWorkspaceClass = additionalData?.workspaceClasses?.regular || "";
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

    const [supportedClasses, setSupportedClasses] = useState<SupportedWorkspaceClass[]>([]);

    useEffect(() => {
        const fetchClasses = async () => {
            const classes = await getGitpodService().server.getSupportedWorkspaceClasses();
            setSupportedClasses(classes);

            if (!workspaceClass) {
                setWorkspaceClass(classes.find((c) => c.isSelected)?.id || "");
            }
        };

        fetchClasses().catch(console.error);
    }, []);

    if (!props.enabled) {
        return <div></div>;
    } else {
        return (
            <div>
                <p className="text-base text-gray-500 dark:text-gray-400">
                    Choose the workspace machine type for your workspaces.
                </p>
                <div className="mt-4 space-x-3 flex">
                    {supportedClasses.map((c) => {
                        return (
                            <WorkspaceClass
                                additionalStyles="w-80 h-32"
                                selected={workspaceClass === c.id}
                                onClick={() => actuallySetWorkspaceClass(c.id)}
                                category={c.category}
                                friendlyName={c.displayName}
                                description={c.description}
                                powerUps={c.powerups}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }
}
