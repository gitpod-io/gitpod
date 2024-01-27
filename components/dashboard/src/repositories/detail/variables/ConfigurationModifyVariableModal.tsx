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
import { useToast } from "../../../components/toasts/Toasts";
import { TextInputField } from "../../../components/forms/TextInputField";

type Props = {
    configurationId: string;
    /**
     * If set, the modal will be used to edit the variable instead of creating a new one.
     */
    variable?: ConfigurationEnvironmentVariable;
    onClose: () => void;
};
export const ModifyVariableModal = ({ configurationId, variable, onClose }: Props) => {
    const { toast } = useToast();

    const [name, setName] = useState<string>(variable?.name ?? "");
    // We do not want to show the previous value of the variable
    const [value, setValue] = useState<string>("");
    const [admission, setAdmission] = useState<EnvironmentVariableAdmission>(
        variable?.admission || EnvironmentVariableAdmission.EVERYWHERE,
    );
    const createVariable = useCreateConfigurationVariable();
    const updateVariable = useUpdateConfigurationVariable();
    const isEditing = !!variable;

    const addVariable = useCallback(() => {
        createVariable.mutateAsync(
            {
                configurationId,
                name,
                value,
                admission,
            },
            {
                onSuccess: () => {
                    toast("Variable added");
                    onClose();
                },
            },
        );
    }, [createVariable, configurationId, name, value, admission, onClose, toast]);

    const editVariable = useCallback(() => {
        if (!variable) {
            return;
        }
        updateVariable.mutate(
            {
                variableId: variable.id,
                configurationId,
                name: variable.name,
                value,
                admission,
            },
            {
                onSuccess: () => {
                    toast("Variable updated");
                    onClose();
                },
            },
        );
    }, [variable, updateVariable, configurationId, value, admission, onClose, toast]);

    const handleSubmission = useCallback(() => {
        if (isEditing) {
            editVariable();
        } else {
            addVariable();
        }
    }, [isEditing, editVariable, addVariable]);

    return (
        <Modal visible onClose={onClose} onSubmit={handleSubmission}>
            <ModalHeader>{isEditing ? "Edit" : "Add a"} variable</ModalHeader>
            <ModalBody>
                <div className="mt-8">
                    <TextInputField
                        autoFocus={!isEditing}
                        required={!isEditing}
                        label="Name"
                        disabled={isEditing}
                        autoComplete={"off"}
                        className="w-full"
                        value={name}
                        placeholder="Variable name"
                        onChange={(name) => setName(name)}
                    />
                </div>
                <div className="mt-4">
                    <TextInputField
                        autoFocus={isEditing}
                        required={true}
                        label="Value"
                        autoComplete={"off"}
                        className="w-full"
                        value={value}
                        placeholder="Variable value"
                        onChange={(value) => setValue(value)}
                    />
                </div>
                <CheckboxInputField
                    label="Only use this variable in Prebuilds"
                    hint="This will hide the variable in the workspace, however, it may still appear in system logs."
                    checked={admission === EnvironmentVariableAdmission.PREBUILD}
                    onChange={(checked) =>
                        setAdmission(
                            checked ? EnvironmentVariableAdmission.PREBUILD : EnvironmentVariableAdmission.EVERYWHERE,
                        )
                    }
                />
            </ModalBody>
            <ModalFooter
                alert={
                    createVariable.isError || updateVariable.isError ? (
                        <ModalFooterAlert type="danger">
                            {String(createVariable.error || updateVariable.error).replace(
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
                {isEditing ? (
                    <LoadingButton type="submit" loading={updateVariable.isLoading}>
                        Update variable
                    </LoadingButton>
                ) : (
                    <LoadingButton type="submit" loading={createVariable.isLoading}>
                        Add variable
                    </LoadingButton>
                )}
            </ModalFooter>
        </Modal>
    );
};
