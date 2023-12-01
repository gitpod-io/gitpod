/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useWorkspaceClasses } from "../../../data/workspaces/workspace-classes-query";
import { LoadingState } from "@podkit/loading/LoadingState";
import { cn } from "@podkit/lib/cn";
import Alert from "../../../components/Alert";
import { Label } from "@podkit/forms/Label";
import { RadioGroup, RadioGroupItem } from "@podkit/forms/RadioListField";

type Props = {
    value: string;
    className?: string;
    onChange: (newValue: string) => void;
};
export const WorkspaceClassOptions: FC<Props> = ({ value, className, onChange }) => {
    const { data: classes, isLoading } = useWorkspaceClasses();

    if (isLoading) {
        return <LoadingState />;
    }

    if (!classes) {
        return <Alert type="error">There was a problem loading workspace classes.</Alert>;
    }

    return (
        <RadioGroup value={value} onValueChange={onChange} className={cn("mt-4", className)}>
            {classes.map((wsClass) => (
                <Label className="flex items-start space-x-2 my-2" key={wsClass.id}>
                    <RadioGroupItem value={wsClass.id} />
                    <div className="flex flex-col space-y-2">
                        <span className="font-bold">{wsClass.displayName}</span>
                        <span>{wsClass.description}</span>
                    </div>
                </Label>
            ))}
        </RadioGroup>
    );
};
