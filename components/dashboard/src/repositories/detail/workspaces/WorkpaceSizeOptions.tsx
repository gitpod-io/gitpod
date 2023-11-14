/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useState } from "react";
import { useWorkspaceClasses } from "../../../data/workspaces/workspace-classes-query";
import { Label } from "@podkit/forms/Label";
import { RadioGroup, RadioGroupItem } from "@podkit/forms/RadioListField";

interface Props {
    configuration: Configuration;
}

export const ConfigurationWorkspaceSizeOptions = ({ configuration }: Props) => {
    const [selectedValue, setSelectedValue] = useState(
        configuration.workspaceSettings?.workspaceClass || "g1-standard",
    );
    const { data: classes, isError, isLoading } = useWorkspaceClasses();

    if (isError) {
        return <div>Something went wrong</div>;
    }

    if (isLoading || !classes) {
        return <div>Loading...</div>;
    }

    return (
        <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
            {classes.map((wsClass) => (
                <div className="flex items-center space-x-2 my-4">
                    <RadioGroupItem value={wsClass.id} id={wsClass.id} />
                    <Label htmlFor={wsClass.id}>{wsClass.displayName}</Label>
                </div>
            ))}
        </RadioGroup>
    );
};
