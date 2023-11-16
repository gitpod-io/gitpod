/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";
import { useSetProjectEnvVar } from "../../../data/projects/set-project-env-var-mutation";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import Modal, { ModalHeader, ModalBody, ModalFooter, ModalFooterAlert } from "../../../components/Modal";
import { CheckboxInputField } from "../../../components/forms/CheckboxInputField";
import { Button } from "@podkit/buttons/Button";

type Props = {
    configuration: Configuration;
    onClose: () => void;
};

export const AddVariableModal = ({ configuration, onClose }: Props) => {
    const [name, setName] = useState<string>("");
    const [value, setValue] = useState<string>("");
    const [prebuildOnly, setPrebuildOnly] = useState<boolean>(true);
    const setProjectEnvVar = useSetProjectEnvVar();

    const addVariable = useCallback(async () => {
        await setProjectEnvVar.mutateAsync(
            {
                projectId: configuration.id,
                name,
                value,
                censored: prebuildOnly,
            },
            { onSuccess: onClose },
        );
    }, [prebuildOnly, name, onClose, configuration, setProjectEnvVar, value]);

    return (
        <Modal visible onClose={onClose} onSubmit={addVariable}>
            <ModalHeader>Add a variable</ModalHeader>
            <ModalBody>
                <div className="mt-8">
                    <h4>Name</h4>
                    <input
                        autoFocus
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
                    hint="This will hide the variable in the workspace, however, they may still appear in system logs."
                    checked={prebuildOnly}
                    onChange={() => setPrebuildOnly(!prebuildOnly)}
                />
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
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={setProjectEnvVar.isLoading}>
                    Add Variable
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
