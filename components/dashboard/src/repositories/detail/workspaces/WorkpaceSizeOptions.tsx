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
import { Heading2 } from "@podkit/typography/Headings";
import { TextMuted } from "@podkit/typography/TextMuted";

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
        <section>
            <div className="mb-4">
                <Heading2 className="text-base font-bold mb-2" asChild>
                    Workspace Size Options
                </Heading2>
                <TextMuted>Choose the size of your workspace based on the resources you need.</TextMuted>
            </div>
            <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
                {classes.map((wsClass) => (
                    <div className="flex items-start space-x-2 my-4">
                        <RadioGroupItem value={wsClass.id} id={wsClass.id} />
                        <div className="flex flex-col">
                            <Label htmlFor={wsClass.id} className="font-bold">
                                {wsClass.displayName}
                            </Label>
                            <span>{wsClass.description}</span>
                        </div>
                    </div>
                ))}
            </RadioGroup>
        </section>
    );
};
