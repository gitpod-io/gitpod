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
import { EnvironmentVariableAdmission } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { useCreateConfigurationVariable } from "../../../data/configurations/configuration-queries";
import { useToast } from "../../../components/toasts/Toasts";
import { TextInputField } from "../../../components/forms/TextInputField";

type Props = {
    configurationId: string;
    onClose: () => void;
};
export const AddVariableModal = ({ configurationId, onClose }: Props) => {
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [admission, setAdmission] = useState<EnvironmentVariableAdmission>(EnvironmentVariableAdmission.EVERYWHERE);
    const createVariable = useCreateConfigurationVariable();

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

    return (
        <Modal visible onClose={onClose} onSubmit={addVariable}>
            <ModalHeader>Add a variable</ModalHeader>
            <ModalBody>
                <div className="mt-8">
                    <TextInputField
                        label="Name"
                        autoComplete={"off"}
                        className="w-full"
                        value={name}
                        placeholder="Variable name"
                        onChange={(name) => setName(name)}
                        autoFocus
                        required
                    />
                </div>
                <div className="mt-4">
                    <TextInputField
                        label="Value"
                        autoComplete={"off"}
                        className="w-full"
                        value={value}
                        placeholder="Variable value"
                        onChange={(value) => setValue(value)}
                        required
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
                <LoadingButton type="submit" loading={createVariable.isLoading}>
                    Add Variable
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
