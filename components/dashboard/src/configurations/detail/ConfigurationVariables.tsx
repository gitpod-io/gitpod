/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { useCallback, useState } from "react";
import { Heading2, Subheading } from "@podkit/typography/headings";
import {
    useDeleteProjectEnvironmentVariable,
    useListProjectEnvironmentVariables,
    useSetProjectEnvVar,
} from "../../data/projects/set-project-env-var-mutation";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import Alert from "../../components/Alert";
import { CheckboxInputField } from "../../components/forms/CheckboxInputField";
import InfoBox from "../../components/InfoBox";
import { ItemsList, Item, ItemField } from "../../components/ItemsList";
import { Text } from "@podkit/typography/Text";
import { QuestionTooltip } from "@podkit/tooltip/QuestionTooltip";
import { Button } from "@podkit/button/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@podkit/drop-down/DropDown";
import { cn } from "@podkit/lib/cn";

interface ConfigurationVariablesProps {
    configuration: Project;
}

export default function ConfigurationEnvironmentVariables({ configuration }: ConfigurationVariablesProps) {
    const { data: envVars, isLoading } = useListProjectEnvironmentVariables(configuration.id);
    const deleteEnvVarMutation = useDeleteProjectEnvironmentVariable(configuration.id);

    const [modalState, setModalState] = useState<{
        open: boolean;
        action?: AddVariableModalProps["action"];
        presetName?: AddVariableModalProps["presetName"];
    }>({ open: false });

    const showModal = useCallback(
        (action?: AddVariableModalProps["action"], presetName?: AddVariableModalProps["presetName"]) => {
            setModalState({ open: true, action, presetName });
        },
        [],
    );

    if (isLoading || !envVars) {
        return null;
    }

    return (
        <section className="max-w-lg">
            {modalState.open && (
                <VariableModal
                    configuration={configuration}
                    onClose={() => {
                        setModalState({ open: false });
                    }}
                    action={modalState.action}
                    presetName={modalState.presetName}
                />
            )}
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
                    {envVars.map((variable) => {
                        return (
                            <Item key={variable.id} className="grid grid-cols-3 items-center">
                                <ItemField className="truncate font-mono">{variable.name}</ItemField>
                                <ItemField>{variable.censored ? "Hidden" : "Visible"}</ItemField>
                                <ItemField className="flex justify-end">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger>
                                            <svg
                                                className={cn(
                                                    "w-8 h-8 p-1 rounded-md text-gray-600 dark:text-gray-300",
                                                    "focus:bg-gray-200 dark:focus:bg-gray-700",
                                                )}
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                            >
                                                <title>Actions</title>
                                                <g fill="currentColor" transform="rotate(90 12 12)">
                                                    <circle cx="1" cy="1" r="2" transform="translate(5 11)" />
                                                    <circle cx="1" cy="1" r="2" transform="translate(11 11)" />
                                                    <circle cx="1" cy="1" r="2" transform="translate(17 11)" />
                                                </g>
                                            </svg>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => showModal("update", variable.name)}>
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600 dark:text-red-400 focus:text-red-800 dark:focus:text-red-300"
                                                onClick={() => {
                                                    deleteEnvVarMutation.mutate(variable.id);
                                                }}
                                            >
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </ItemField>
                            </Item>
                        );
                    })}
                </ItemsList>
            )}
            <button className="mt-2" onClick={() => showModal()}>
                New Variable
            </button>
        </section>
    );
}

interface AddVariableModalProps {
    configuration: Project;
    onClose: () => void;
    action?: "add" | "update";
    presetName?: string;
}

function VariableModal({ configuration, onClose, action = "add", presetName }: AddVariableModalProps) {
    const [name, setName] = useState<string>(presetName ?? "");
    const [value, setValue] = useState<string>("");
    const [censored, setCensored] = useState<boolean>(true);
    const setConfigurationEnvVar = useSetProjectEnvVar();

    const addVariable = useCallback(async () => {
        await setConfigurationEnvVar.mutateAsync(
            {
                projectId: configuration.id,
                name,
                value,
                censored,
            },
            { onSuccess: onClose },
        );
    }, [censored, name, onClose, configuration, setConfigurationEnvVar, value]);

    return (
        <Modal visible onClose={onClose} onSubmit={addVariable}>
            <ModalHeader>{action === "add" ? "Add Variable" : "Update Variable"}</ModalHeader>
            <ModalBody>
                {action === "add" && (
                    <Alert type="warning">
                        <strong>Configuration environment variables can be exposed.</strong>
                        <br />
                        Even if <strong>Hide Variable in Workspaces</strong> is enabled, anyone with read access to your
                        repository can access secret values if they are printed in the terminal, logged, or persisted to
                        the file system.
                    </Alert>
                )}
                <div className="mt-8">
                    <h4>Name</h4>
                    <input
                        autoFocus={action === "add"}
                        className="w-full"
                        type="text"
                        name="name"
                        value={name}
                        readOnly={action === "update"}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <h4>Value</h4>
                    <input
                        autoFocus={action === "update"}
                        className="w-full"
                        type="text"
                        name="value"
                        value={value}
                        placeholder={action === "update" ? "Existing value redacted" : ""}
                        onChange={(e) => setValue(e.target.value)}
                    />
                </div>
                <CheckboxInputField
                    label="Hide Variable in Workspaces"
                    hint="Unset this environment variable so that it's not accessible from the terminal in workspaces."
                    checked={censored}
                    onChange={() => setCensored(!censored)}
                />
                {!censored && (
                    <div className="mt-4">
                        <InfoBox>
                            This variable will be visible to anyone who starts a Gitpod Workspace for your repository.
                        </InfoBox>
                    </div>
                )}
            </ModalBody>
            <ModalFooter
                alert={
                    setConfigurationEnvVar.isError ? (
                        <ModalFooterAlert type="danger">
                            {String(setConfigurationEnvVar.error).replace(
                                /Error: Request \w+ failed with message: /,
                                "",
                            )}
                        </ModalFooterAlert>
                    ) : null
                }
            >
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" loading={setConfigurationEnvVar.isLoading}>
                    Save
                </Button>
            </ModalFooter>
        </Modal>
    );
}
