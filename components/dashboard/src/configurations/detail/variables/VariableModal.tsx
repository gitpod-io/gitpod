/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";
import { useSetProjectEnvVar } from "../../../data/projects/set-project-env-var-mutation";
import type { Project } from "@gitpod/gitpod-protocol";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../../components/Modal";
import Alert from "../../../components/Alert";
import { CheckboxInputField } from "../../../components/forms/CheckboxInputField";
import InfoBox from "../../../components/InfoBox";
import { Button, LoadingButton } from "@podkit/button/Button";

interface AddVariableModalProps {
    configuration: Project;
    onClose: () => void;
    existingName?: string;
}

export const VariableModal = ({ configuration, onClose, existingName }: AddVariableModalProps) => {
    const [name, setName] = useState<string>(existingName ?? "");
    const [value, setValue] = useState<string>("");
    const [censored, setCensored] = useState<boolean>(true);
    const setConfigurationEnvVar = useSetProjectEnvVar();

    const isUpdating = !!existingName;

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
            <ModalHeader>{!isUpdating ? "Add Variable" : "Update Variable"}</ModalHeader>
            <ModalBody>
                {!isUpdating && (
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
                        autoFocus={!isUpdating}
                        className="w-full"
                        type="text"
                        name="name"
                        value={name}
                        readOnly={isUpdating}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="mt-4">
                    <h4>Value</h4>
                    <input
                        autoFocus={isUpdating}
                        className="w-full"
                        type="text"
                        name="value"
                        value={value}
                        placeholder={isUpdating ? "Existing value redacted" : undefined}
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
                <LoadingButton type="submit" loading={setConfigurationEnvVar.isLoading}>
                    Save
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
