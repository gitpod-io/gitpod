/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { trackEvent } from "../Analytics";
import WorkspaceClass from "../components/WorkspaceClass";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";

interface SelectWorkspaceClassProps {
    workspaceClass?: string;
    setWorkspaceClass: (value: string) => Promise<string | undefined>;
}

export default function SelectWorkspaceClass(props: SelectWorkspaceClassProps) {
    const [workspaceClass, setWorkspaceClass] = useState<string | undefined>(props.workspaceClass);
    const actuallySetWorkspaceClass = async (value: string) => {
        const previousValue = await props.setWorkspaceClass(value);
        if (previousValue !== value) {
            trackEvent("workspace_class_changed", {
                previous: previousValue,
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
                setWorkspaceClass(classes.find((c) => c.isDefault)?.id || "");
            }
        };

        fetchClasses().catch(console.error);
    }, []);

    return (
        <div className="mt-4 space-x-3 flex">
            {supportedClasses.map((c) => {
                return (
                    <WorkspaceClass
                        additionalStyles="w-80"
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
    );
}
