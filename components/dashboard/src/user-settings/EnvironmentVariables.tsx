/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserEnvVar, UserEnvVarValue } from "@gitpod/gitpod-protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmationModal from "../components/ConfirmationModal";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { EnvironmentVariableEntry } from "./EnvironmentVariableEntry";
import { Heading2, Subheading } from "../components/typography/headings";
import { envVarClient } from "../service/public-api";
import { UserEnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { Button } from "@podkit/buttons/Button";
import { TextInputField } from "../components/forms/TextInputField";

interface EnvVarModalProps {
    envVar: UserEnvVarValue;
    onClose: () => void;
    save: (v: UserEnvVarValue) => void;
    validate: (v: UserEnvVarValue) => string | undefined;
}

function AddEnvVarModal(p: EnvVarModalProps) {
    const [ev, setEv] = useState({ ...p.envVar });
    const [error, setError] = useState("");
    const ref = useRef(ev);

    const update = (pev: Partial<UserEnvVarValue>) => {
        const newEnv = { ...ref.current, ...pev };
        setEv(newEnv);
        ref.current = newEnv;
    };

    useEffect(() => {
        setEv({ ...p.envVar });
        setError("");
    }, [p.envVar]);

    const isNew = !p.envVar.id;
    let save = useCallback(async () => {
        const v = ref.current;
        const errorMsg = p.validate(v);
        if (!!errorMsg) {
            setError(errorMsg);
        } else {
            await p.save(v);
            p.onClose();
        }
    }, [p]);

    return (
        <Modal visible={true} onClose={p.onClose} onSubmit={save}>
            <ModalHeader>{isNew ? "New" : "Edit"} Variable</ModalHeader>
            <ModalBody>
                {error ? (
                    <div className="bg-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">{error}</div>
                ) : null}
                <TextInputField
                    label="Name"
                    value={ev.name}
                    type="text"
                    autoFocus
                    onChange={(val) => update({ name: val })}
                />

                <TextInputField label="Value" value={ev.value} type="text" onChange={(val) => update({ value: val })} />

                <TextInputField
                    label="Scope"
                    hint={
                        <>
                            You can pass a variable for a specific project or use wildcard character (<code>*/*</code>)
                            to make it available in more projects.
                        </>
                    }
                    value={ev.repositoryPattern}
                    type="text"
                    placeholder="e.g. owner/repository"
                    onChange={(val) => update({ repositoryPattern: val })}
                />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={p.onClose}>
                    Cancel
                </Button>
                <Button type="submit">{isNew ? "Add" : "Update"} Variable</Button>
            </ModalFooter>
        </Modal>
    );
}

function DeleteEnvVarModal(p: { variable: UserEnvVarValue; deleteVariable: () => void; onClose: () => void }) {
    return (
        <ConfirmationModal
            title="Delete Variable"
            areYouSureText="Are you sure you want to delete this variable?"
            buttonText="Delete Variable"
            onClose={p.onClose}
            onConfirm={async () => {
                await p.deleteVariable();
                p.onClose();
            }}
        >
            <div className="grid grid-cols-2 gap-4 px-3 text-sm text-gray-400">
                <span className="truncate">Name</span>
                <span className="truncate">Scope</span>
            </div>
            <div className="grid grid-cols-2 gap-4 p-3 mt-3 text-gray-400 bg-pk-surface-secondary rounded-xl">
                <span className="truncate text-gray-900 dark:text-gray-50">{p.variable.name}</span>
                <span className="truncate text-sm">{p.variable.repositoryPattern}</span>
            </div>
        </ConfirmationModal>
    );
}

function sortEnvVars(a: UserEnvironmentVariable, b: UserEnvironmentVariable) {
    if (a.name === b.name) {
        return a.repositoryPattern > b.repositoryPattern ? 1 : -1;
    }
    return a.name > b.name ? 1 : -1;
}

export default function EnvVars() {
    const [envVars, setEnvVars] = useState([] as UserEnvVarValue[]);
    const [currentEnvVar, setCurrentEnvVar] = useState({
        id: undefined,
        name: "",
        value: "",
        repositoryPattern: "",
    } as UserEnvVarValue);
    const [isAddEnvVarModalVisible, setAddEnvVarModalVisible] = useState(false);
    const [isDeleteEnvVarModalVisible, setDeleteEnvVarModalVisible] = useState(false);
    const update = async () => {
        await envVarClient.listUserEnvironmentVariables({}).then((r) =>
            setEnvVars(
                r.environmentVariables.sort(sortEnvVars).map((e) => ({
                    id: e.id,
                    name: e.name,
                    value: e.value,
                    repositoryPattern: e.repositoryPattern,
                })),
            ),
        );
    };

    useEffect(() => {
        update();
    }, []);

    const add = () => {
        setCurrentEnvVar({ id: undefined, name: "", value: "", repositoryPattern: "" });
        setAddEnvVarModalVisible(true);
        setDeleteEnvVarModalVisible(false);
    };

    const edit = (variable: UserEnvVarValue) => {
        setCurrentEnvVar(variable);
        setAddEnvVarModalVisible(true);
        setDeleteEnvVarModalVisible(false);
    };

    const confirmDeleteVariable = (variable: UserEnvVarValue) => {
        setCurrentEnvVar(variable);
        setAddEnvVarModalVisible(false);
        setDeleteEnvVarModalVisible(true);
    };

    const save = async (variable: UserEnvVarValue) => {
        if (variable.id) {
            await envVarClient.updateUserEnvironmentVariable({
                environmentVariableId: variable.id,
                name: variable.name,
                value: variable.value,
                repositoryPattern: variable.repositoryPattern,
            });
        } else {
            await envVarClient.createUserEnvironmentVariable({
                name: variable.name,
                value: variable.value,
                repositoryPattern: variable.repositoryPattern,
            });
        }

        await update();
    };

    const deleteVariable = async (variable: UserEnvVarValue) => {
        await envVarClient.deleteUserEnvironmentVariable({
            environmentVariableId: variable.id,
        });
        await update();
    };

    const validate = (variable: UserEnvVarValue): string | undefined => {
        const name = variable.name;
        const pattern = variable.repositoryPattern;
        const validationError = UserEnvVar.validate(variable);
        if (validationError) {
            return validationError;
        }
        if (!variable.id && envVars.some((v) => v.name === name && v.repositoryPattern === pattern)) {
            return "A variable with this name and scope already exists";
        }
        return undefined;
    };

    return (
        <PageWithSettingsSubMenu>
            {isAddEnvVarModalVisible && (
                <AddEnvVarModal
                    save={save}
                    envVar={currentEnvVar}
                    validate={validate}
                    onClose={() => setAddEnvVarModalVisible(false)}
                />
            )}
            {isDeleteEnvVarModalVisible && (
                <DeleteEnvVarModal
                    variable={currentEnvVar}
                    deleteVariable={async () => await deleteVariable(currentEnvVar)}
                    onClose={() => setDeleteEnvVarModalVisible(false)}
                />
            )}
            <div className="flex items-start sm:justify-between mb-2">
                <div>
                    <Heading2>Environment Variables</Heading2>
                    <Subheading>
                        Variables are used to store information like passwords.{" "}
                        <a
                            className="gp-link"
                            href="https://www.gitpod.io/docs/configure/projects/environment-variables#environment-variables"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Learn more
                        </a>
                    </Subheading>
                </div>
                {envVars.length !== 0 ? (
                    <div className="flex mt-0">
                        <Button onClick={add} className="ml-2">
                            New Variable
                        </Button>
                    </div>
                ) : null}
            </div>
            {envVars.length === 0 ? (
                <div className="bg-pk-surface-secondary rounded-xl w-full h-96">
                    <div className="pt-28 flex flex-col items-center w-96 m-auto">
                        <Heading2 className="text-pk-content-invert-secondary text-center pb-3">
                            No Environment Variables
                        </Heading2>
                        <Subheading className="text-center pb-6">
                            In addition to user-specific environment variables you can also pass variables through a
                            workspace creation URL.
                        </Subheading>
                        <Button onClick={add}>New Variable</Button>
                    </div>
                </div>
            ) : (
                <ItemsList>
                    <Item header={true}>
                        <ItemField className="w-5/12 my-auto">Name</ItemField>
                        <ItemField className="w-5/12 my-auto">Scope</ItemField>
                    </Item>
                    {envVars.map((variable) => (
                        <EnvironmentVariableEntry
                            key={variable.id}
                            variable={variable}
                            edit={edit}
                            confirmDeleteVariable={confirmDeleteVariable}
                        />
                    ))}
                </ItemsList>
            )}
        </PageWithSettingsSubMenu>
    );
}
