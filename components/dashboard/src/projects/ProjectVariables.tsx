/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Project, ProjectEnvVar } from '@gitpod/gitpod-protocol';
import { useContext, useEffect, useState } from 'react';
import AlertBox from '../components/AlertBox';
import CheckBox from '../components/CheckBox';
import InfoBox from '../components/InfoBox';
import { Item, ItemField, ItemFieldContextMenu, ItemsList } from '../components/ItemsList';
import Modal from '../components/Modal';
import { getGitpodService } from '../service/service';
import { ProjectContext } from './project-context';
import { ProjectSettingsPage } from './ProjectSettings';

export default function () {
    const { project } = useContext(ProjectContext);
    const [envVars, setEnvVars] = useState<ProjectEnvVar[]>([]);
    const [showAddVariableModal, setShowAddVariableModal] = useState<boolean>(false);

    const updateEnvVars = async () => {
        if (!project) {
            return;
        }
        const vars = await getGitpodService().server.getProjectEnvironmentVariables(project.id);
        const sortedVars = vars.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
        setEnvVars(sortedVars);
    };

    useEffect(() => {
        updateEnvVars();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    const deleteEnvVar = async (variableId: string) => {
        await getGitpodService().server.deleteProjectEnvironmentVariable(variableId);
        updateEnvVars();
    };

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
                    <h3>Environment Variables</h3>
                    <h2 className="text-gray-500">Manage project-specific environment variables.</h2>
                </div>
                {envVars.length > 0 && <button onClick={() => setShowAddVariableModal(true)}>New Variable</button>}
            </div>
            {envVars.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center">
                    <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Environment Variables</h3>
                    <p className="text-center pb-6 text-gray-500 text-base w-96">
                        All <strong>project-specific environment variables</strong> will be visible in prebuilds and
                        optionally in workspaces for this project.
                    </p>
                    <button onClick={() => setShowAddVariableModal(true)}>New Variable</button>
                </div>
            ) : (
                <>
                    <ItemsList>
                        <Item header={true} className="grid grid-cols-3 items-center">
                            <ItemField>Name</ItemField>
                            <ItemField>Visibility in Workspaces</ItemField>
                            <ItemField></ItemField>
                        </Item>
                        {envVars.map((variable) => {
                            return (
                                <Item className="grid grid-cols-3 items-center">
                                    <ItemField>{variable.name}</ItemField>
                                    <ItemField>{variable.censored ? 'Hidden' : 'Visible'}</ItemField>
                                    <ItemField className="flex justify-end">
                                        <ItemFieldContextMenu
                                            menuEntries={[
                                                {
                                                    title: 'Delete',
                                                    customFontStyle:
                                                        'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                                                    onClick: () => deleteEnvVar(variable.id),
                                                },
                                            ]}
                                        />
                                    </ItemField>
                                </Item>
                            );
                        })}
                    </ItemsList>
                </>
            )}
        </ProjectSettingsPage>
    );
}

function AddVariableModal(props: { project?: Project; onClose: () => void }) {
    const [name, setName] = useState<string>('');
    const [value, setValue] = useState<string>('');
    const [censored, setCensored] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>();

    const addVariable = async () => {
        if (!props.project) {
            return;
        }
        try {
            await getGitpodService().server.setProjectEnvironmentVariable(props.project.id, name, value, censored);
            props.onClose();
        } catch (err) {
            console.error(err);
            setError(err);
        }
    };

    return (
        <Modal
            visible={true}
            onClose={props.onClose}
            onEnter={() => {
                addVariable();
                return false;
            }}
        >
            <h3 className="mb-4">New Variable</h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 flex flex-col">
                <AlertBox>
                    <strong>Project environment variables can be exposed.</strong>
                    <br />
                    Even if <strong>Hide Variable in Workspaces</strong> is enabled, anyone with read access to your
                    repository can access secret values if they are printed in the terminal, logged, or persisted to the
                    file system.
                </AlertBox>
                {error && (
                    <AlertBox className="mt-4">
                        {String(error).replace(/Error: Request \w+ failed with message: /, '')}
                    </AlertBox>
                )}
                <div className="mt-8">
                    <h4>Name</h4>
                    <input
                        autoFocus
                        className="w-full"
                        type="text"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <h4>Value</h4>
                    <input
                        className="w-full"
                        type="text"
                        name="value"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <CheckBox
                        title="Hide Variable in Workspaces"
                        desc="Unset this environment variable so that it's not accessible from the terminal in workspaces."
                        checked={censored}
                        onChange={() => setCensored(!censored)}
                    />
                </div>
                {!censored && (
                    <div className="mt-4">
                        <InfoBox>
                            This variable will be visible to anyone who starts a Gitpod workspace for your repository.
                        </InfoBox>
                    </div>
                )}
            </div>
            <div className="flex justify-end mt-6">
                <button className="secondary" onClick={props.onClose}>
                    Cancel
                </button>
                <button className="ml-2" onClick={addVariable}>
                    Add Variable
                </button>
            </div>
        </Modal>
    );
}
