/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationEnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { useCallback, useState } from "react";
import { OrganizationRemoveEnvvarModal } from "./OrganizationRemoveEnvvarModal";
import { InputField } from "../../components/forms/InputField";
import { ReactComponent as Stack } from "../../icons/Repository.svg";
import { Button } from "@podkit/buttons/Button";
import { useCreateOrganizationEnvironmentVariable } from "../../data/organizations/org-envvar-queries";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { TextInputField } from "../../components/forms/TextInputField";
import { useToast } from "../../components/toasts/Toasts";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { MiddleDot } from "../../components/typography/MiddleDot";

type Props = {
    disabled?: boolean;
    organizationId: string;
    name: string;
    variable: OrganizationEnvironmentVariable | undefined;
};
export const NamedOrganizationEnvvarItem = ({ disabled, organizationId, name, variable }: Props) => {
    const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
    const [showAddModal, setShowAddModal] = useState<boolean>(false);

    const value = variable ? "*****" : "not set";

    return (
        <>
            {variable && showRemoveModal && (
                <OrganizationRemoveEnvvarModal
                    variable={variable}
                    organizationId={organizationId}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}

            {showAddModal && (
                <AddOrgEnvironmentVariableModal
                    organizationId={organizationId}
                    staticName={name}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            <InputField disabled={disabled} className="w-full max-w-lg">
                <div className="flex flex-col bg-pk-surface-secondary p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 flex items-center overflow-hidden h-8 gap-2" title={value}>
                            <Stack className="w-5 h-5" />
                            <span className="truncate font-medium text-pk-content-secondary">{name}</span>
                        </div>
                        {!disabled && !variable && (
                            <Button variant="link" onClick={() => setShowAddModal(true)}>
                                Add
                            </Button>
                        )}
                        {!disabled && variable && (
                            <Button variant="link" onClick={() => setShowRemoveModal(true)}>
                                Delete
                            </Button>
                        )}
                    </div>
                    <div className="mx-7 text-pk-content-tertiary truncate">
                        {value}
                        {disabled && (
                            <>
                                <MiddleDot />
                                Requires <span className="font-medium">Owner</span> permissions to change
                            </>
                        )}
                    </div>
                </div>
            </InputField>
        </>
    );
};

type AddOrgEnvironmentVariableModalProps = {
    organizationId: string;
    staticName?: string;
    onClose: () => void;
};
export const AddOrgEnvironmentVariableModal = ({
    organizationId,
    staticName,
    onClose,
}: AddOrgEnvironmentVariableModalProps) => {
    const { toast } = useToast();

    const [name, setName] = useState(staticName || "");
    const [value, setValue] = useState("");
    const createVariable = useCreateOrganizationEnvironmentVariable();

    const addVariable = useCallback(() => {
        createVariable.mutateAsync(
            {
                organizationId,
                name,
                value,
            },
            {
                onSuccess: () => {
                    toast("Variable added");
                    onClose();
                },
            },
        );
    }, [createVariable, organizationId, name, value, onClose, toast]);

    return (
        <Modal visible onClose={onClose} onSubmit={addVariable}>
            <ModalHeader>Add a variable</ModalHeader>
            <ModalBody>
                <div>
                    <TextInputField
                        disabled={staticName !== undefined}
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
