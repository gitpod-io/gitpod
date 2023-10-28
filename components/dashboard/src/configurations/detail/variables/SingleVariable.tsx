/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@podkit/drop-down/DropDown";
import { Item, ItemField } from "../../../components/ItemsList";
import { MoreVertical } from "lucide-react";
import { cn } from "@podkit/lib/cn";
import type { Project, ProjectEnvVar } from "@gitpod/gitpod-protocol";
import { useDeleteProjectEnvironmentVariable } from "../../../data/projects/set-project-env-var-mutation";
import { VariableModal } from "./VariableModal";
import { useState } from "react";

interface SingleVariableItemProps {
    variable: ProjectEnvVar;
    configuration: Project;
}

export const SingleVariableItem = ({ variable, configuration }: SingleVariableItemProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const deleteEnvVarMutation = useDeleteProjectEnvironmentVariable(configuration.id);

    return (
        <>
            <Item key={variable.id} className="grid grid-cols-3 items-center">
                <ItemField className="truncate font-mono">{variable.name}</ItemField>
                <ItemField>{variable.censored ? "Hidden" : "Visible"}</ItemField>
                <ItemField className="flex justify-end">
                    <DropdownMenu>
                        {/* Todo: finally move the styles out of index.css */}
                        <DropdownMenuTrigger className="unstyled">
                            <MoreVertical
                                className={cn(
                                    "w-8 h-8 p-1 rounded-md text-gray-600 dark:text-gray-300",
                                    "hover:bg-gray-200 dark:hover:bg-gray-700",
                                )}
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => setIsModalOpen(true)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-600 dark:text-red-400 focus:text-red-800 dark:focus:text-red-300"
                                onSelect={() => {
                                    deleteEnvVarMutation.mutate(variable.id);
                                }}
                            >
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </ItemField>
            </Item>
            {isModalOpen && (
                <VariableModal
                    configuration={configuration}
                    onClose={() => {
                        setIsModalOpen(false);
                    }}
                    existingName={variable.name}
                />
            )}
        </>
    );
};
