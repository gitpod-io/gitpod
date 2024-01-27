/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { useCallback, useEffect, useState } from "react";
import { Redirect } from "react-router";
import Alert from "../components/Alert";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import InfoBox from "../components/InfoBox";
import { Item, ItemField, ItemFieldContextMenu, ItemsList } from "../components/ItemsList";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../components/Modal";
import { Heading2, Subheading } from "../components/typography/headings";
import { useCurrentProject } from "./project-context";
import { ProjectSettingsPage } from "./ProjectSettings";
import { useSetProjectEnvVar } from "../data/projects/set-project-env-var-mutation";
import { envVarClient } from "../service/public-api";
import {
    ConfigurationEnvironmentVariable,
    EnvironmentVariableAdmission,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { Button } from "@podkit/buttons/Button";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { TextInputField } from "../components/forms/TextInputField";

export default function ProjectVariablesPage() {
    const { project, loading } = useCurrentProject();
    const [envVars, setEnvVars] = useState<ConfigurationEnvironmentVariable[]>([]);
    const [showAddVariableModal, setShowAddVariableModal] = useState<boolean>(false);

    const updateEnvVars = async () => {
        if (!project) {
            return;
        }
        const resp = await envVarClient.listConfigurationEnvironmentVariables({ configurationId: project.id });
        const sortedVars = resp.environmentVariables.sort((a, b) =>
            a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1,
        );
        setEnvVars(sortedVars);
    };

    useEffect(() => {
        updateEnvVars();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    const deleteEnvVar = async (variableId: string) => {
        await envVarClient.deleteConfigurationEnvironmentVariable({ environmentVariableId: variableId });
        updateEnvVars();
    };

    if (!loading && !project) {
        return <Redirect to="/projects" />;
    }

    return (
        <ProjectSettingsPage project={project}>
            {showAddVariableModal && (
                <AddVariableModal
                    project={project}
                    onClose={() => {
                        updateEnvVars();
                        setShowAddVariableModal(false);
                    }}
                />
            )}
            <div className="mb-2 flex">
                <div className="flex-grow">
                    <Heading2>Environment Variables</Heading2>
                    <Subheading>Manage project-specific environment variables.</Subheading>
                </div>
                {envVars.length > 0 && <Button onClick={() => setShowAddVariableModal(true)}>New Variable</Button>}
            </div>
            {envVars.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center justify-center space-y-3">
                    <Heading2 color="light">No Environment Variables</Heading2>
                    <Subheading className="text-center w-96">
                        All <strong>project-specific environment variables</strong> will be visible in prebuilds and
                        optionally in workspaces for this project.
                    </Subheading>
                    <Button onClick={() => setShowAddVariableModal(true)}>New Variable</Button>
                </div>
            ) : (
                <ItemsList>
                    <Item header={true} className="grid grid-cols-3 items-center">
                        <ItemField>Name</ItemField>
                        <ItemField>Visibility in workspaces</ItemField>
                        <ItemField></ItemField>
                    </Item>
                    {envVars.map((variable) => {
                        return (
                            <Item key={variable.id} className="grid grid-cols-3 items-center">
                                <ItemField className="truncate">{variable.name}</ItemField>
                                <ItemField>
                                    {variable.admission === EnvironmentVariableAdmission.PREBUILD
                                        ? "Hidden"
                                        : "Visible"}
                                </ItemField>
                                <ItemField className="flex justify-end">
                                    <ItemFieldContextMenu
                                        menuEntries={[
                                            {
                                                title: "Delete",
                                                customFontStyle:
                                                    "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                                onClick: () => deleteEnvVar(variable.id),
                                            },
                                        ]}
                                    />
                                </ItemField>
                            </Item>
                        );
                    })}
                </ItemsList>
            )}
        </ProjectSettingsPage>
    );
}

function AddVariableModal(props: { project?: Project; onClose: () => void }) {
    const [name, setName] = useState<string>("");
    const [value, setValue] = useState<string>("");
    const [admission, setAdmission] = useState<EnvironmentVariableAdmission>(EnvironmentVariableAdmission.PREBUILD);
    const setProjectEnvVar = useSetProjectEnvVar();

    const addVariable = useCallback(async () => {
        if (!props.project) {
            return;
        }

        setProjectEnvVar.mutate(
            {
                configurationId: props.project.id,
                name,
                value,
                admission,
            },
            { onSuccess: props.onClose },
        );
    }, [admission, name, props.onClose, props.project, setProjectEnvVar, value]);

    return (
        <Modal visible onClose={props.onClose} onSubmit={addVariable}>
            <ModalHeader>New Variable</ModalHeader>
            <ModalBody>
                <Alert type="warning">
                    <strong>Project environment variables can be exposed.</strong>
                    <br />
                    Even if <strong>Hide variable in workspaces</strong> is enabled, anyone with read access to your
                    repository can access secret values if they are printed in the terminal, logged, or persisted to the
                    file system.
                </Alert>

                <TextInputField label="Name" value={name} type="text" name="name" autoFocus onChange={setName} />

                <TextInputField label="Value" value={value} type="text" name="value" onChange={setValue} />

                <CheckboxInputField
                    label="Hide variable in workspaces"
                    hint="Unset this environment variable so that it's not accessible from the terminal in workspaces."
                    checked={admission === EnvironmentVariableAdmission.PREBUILD}
                    onChange={() =>
                        setAdmission(
                            admission === EnvironmentVariableAdmission.PREBUILD
                                ? EnvironmentVariableAdmission.EVERYWHERE
                                : EnvironmentVariableAdmission.PREBUILD,
                        )
                    }
                />
                {admission === EnvironmentVariableAdmission.EVERYWHERE && (
                    <div className="mt-4">
                        <InfoBox>
                            This variable will be visible to anyone who starts a Gitpod workspace for your repository.
                        </InfoBox>
                    </div>
                )}
            </ModalBody>
            <ModalFooter
                alert={
                    setProjectEnvVar.isError ? (
                        <ModalFooterAlert type="danger">
                            {String(setProjectEnvVar.error).replace(/Error: Request \w+ failed with message: /, "")}
                        </ModalFooterAlert>
                    ) : null
                }
            >
                <Button variant="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={setProjectEnvVar.isLoading}>
                    Add Variable
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
}
