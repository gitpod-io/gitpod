/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalFooterAlert } from "../../../components/Modal";
import { CheckboxInputField } from "../../../components/forms/CheckboxInputField";
import { Button } from "@podkit/buttons/Button";
import {
    ConfigurationEnvironmentVariable,
    EnvironmentVariableAdmission,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import {
    useCreateConfigurationVariable,
    useUpdateConfigurationVariable,
} from "../../../data/configurations/configuration-queries";

type Props = {
    configurationId: string;
    /**
     * If set, the modal will be used to edit the variable instead of creating a new one.
     */
    variable?: ConfigurationEnvironmentVariable;
    onClose: () => void;
};
export const ModifyVariableModal = ({ configurationId, variable, onClose }: Props) => {
    const [name, setName] = useState<string>(variable?.name ?? "");
    // We do not want to show the previous value of the variable
    const [value, setValue] = useState<string>("");
    const [prebuildOnly, setPrebuildOnly] = useState<EnvironmentVariableAdmission>(
        variable?.admission || EnvironmentVariableAdmission.EVERYWHERE,
    );
    const createVariable = useCreateConfigurationVariable();
    const updateVariable = useUpdateConfigurationVariable();

    const addVariable = useCallback(() => {
        createVariable.mutateAsync(
            {
                configurationId: configurationId,
                name,
                value,
                admission: prebuildOnly
                    ? EnvironmentVariableAdmission.PREBUILD
                    : EnvironmentVariableAdmission.EVERYWHERE,
            },
            { onSuccess: onClose },
        );
    }, [prebuildOnly, name, onClose, configurationId, createVariable, value]);

    const editVariable = useCallback(() => {
        if (!variable) {
            return;
        }
        updateVariable.mutate(
            {
                variableId: variable.id,
                configurationId: configurationId,
                name: variable.name,
                value,
                admission: prebuildOnly
                    ? EnvironmentVariableAdmission.PREBUILD
                    : EnvironmentVariableAdmission.EVERYWHERE,
            },
            { onSuccess: onClose },
        );
    }, [variable, updateVariable, configurationId, value, prebuildOnly, onClose]);

    const isEditing = !!variable;

    return (
        <Modal visible onClose={onClose} onSubmit={isEditing ? editVariable : addVariable}>
            <ModalHeader>{isEditing ? "Edit" : "Add a"} variable</ModalHeader>
            <ModalBody>
                <div className="mt-8">
                    <h4>Name</h4>
                    <input
                        autoFocus={!isEditing}
                        disabled={isEditing}
                        autoComplete={"off"}
                        className="w-full"
                        type="text"
                        name="name"
                        value={name}
                        placeholder="Variable name"
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <h4>Value</h4>
                    <input
                        autoFocus={isEditing}
                        required={true}
                        autoComplete={"off"}
                        className="w-full"
                        type="text"
                        name="value"
                        value={value}
                        placeholder="Variable value"
                        onChange={(e) => setValue(e.target.value)}
                    />
                </div>
                <CheckboxInputField
                    label="Only use this variable in Prebuilds"
                    hint="This will hide the variable in the workspace, however, it may still appear in system logs."
                    checked={prebuildOnly === EnvironmentVariableAdmission.PREBUILD}
                    onChange={(checked) =>
                        setPrebuildOnly(
                            checked ? EnvironmentVariableAdmission.PREBUILD : EnvironmentVariableAdmission.EVERYWHERE,
                        )
                    }
                />
            </ModalBody>
            <ModalFooter
                alert={
                    createVariable.isError ? (
                        <ModalFooterAlert type="danger">
                            {String(createVariable.error).replace(/Error: Request \w+ failed with message: /, "")}
                        </ModalFooterAlert>
                    ) : null
                }
            >
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                {isEditing ? (
                    <LoadingButton type="submit" loading={updateVariable.isLoading}>
                        Update Variable
                    </LoadingButton>
                ) : (
                    <LoadingButton type="submit" loading={createVariable.isLoading}>
                        Add Variable
                    </LoadingButton>
                )}
            </ModalFooter>
        </Modal>
    );
};
