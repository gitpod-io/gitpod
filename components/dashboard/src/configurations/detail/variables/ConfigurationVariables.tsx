/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { Heading2, Subheading } from "@podkit/typography/headings";
import { useListProjectEnvironmentVariables } from "../../../data/projects/set-project-env-var-mutation";
import { ItemsList, Item, ItemField } from "../../../components/ItemsList";
import { Text } from "@podkit/typography/Text";
import { QuestionTooltip } from "@podkit/tooltip/QuestionTooltip";
import { Button } from "@podkit/button/Button";
import { SingleVariableItem } from "./SingleVariable";
import { useState } from "react";
import { VariableModal } from "./VariableModal";

interface ConfigurationVariablesProps {
    configuration: Project;
}

export default function ConfigurationEnvironmentVariables({ configuration }: ConfigurationVariablesProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { data: envVars, isLoading, isError } = useListProjectEnvironmentVariables(configuration.id);

    if (isLoading || isError || !envVars) {
        return null;
    }

    return (
        <section className="max-w-lg">
            <div className="mb-2 flex mt-12">
                <div className="flex-grow">
                    <Heading2>Environment Variables</Heading2>
                    <Subheading>Manage configuration-specific environment variables.</Subheading>
                </div>
            </div>
            {envVars.length === 0 ? (
                <div className="bg-blue-50 dark:bg-blue-800 rounded-xl w-full py-2 px-2">
                    <Text className="flex">
                        No Environment Variables are set{" "}
                        <QuestionTooltip>
                            All <strong>configuration-specific environment variables</strong> will be visible in
                            Prebuilds and optionally in Workspaces for this Configuration.
                        </QuestionTooltip>
                    </Text>
                </div>
            ) : (
                <ItemsList>
                    <Item header={true} className="grid grid-cols-3 items-center">
                        <ItemField>Name</ItemField>
                        <ItemField>Visibility in Workspaces</ItemField>
                        <ItemField></ItemField>
                    </Item>
                    {envVars.map((variable) => (
                        <SingleVariableItem key={variable.id} variable={variable} configuration={configuration} />
                    ))}
                </ItemsList>
            )}
            <Button className="mt-2" onClick={() => setIsModalOpen(true)}>
                New Variable
            </Button>
            {isModalOpen && (
                <VariableModal
                    configuration={configuration}
                    onClose={() => {
                        setIsModalOpen(false);
                    }}
                />
            )}
        </section>
    );
}
