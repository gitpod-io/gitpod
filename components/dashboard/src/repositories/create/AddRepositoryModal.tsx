/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import RepositoryFinder from "../../components/RepositoryFinder";
import { InputField } from "../../components/forms/InputField";
import { AuthorizeGit, useNeedsGitAuthorization } from "../../components/AuthorizeGit";
import { useTemporaryState } from "../../hooks/use-temporary-value";
import { CreateConfigurationArgs, useCreateConfiguration } from "../../data/configurations/configuration-queries";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Button } from "@podkit/buttons/Button";

type Props = {
    onCreated: (configuration: Configuration) => void;
    onClose: () => void;
};

export const ImportRepositoryModal: FC<Props> = ({ onClose, onCreated }) => {
    const needsGitAuth = useNeedsGitAuthorization();
    const [selectedRepo, setSelectedRepo] = useState<SuggestedRepository>();
    const createConfiguration = useCreateConfiguration();
    const [createErrorMsg, setCreateErrorMsg] = useTemporaryState("", 3000);

    const handleSubmit = useCallback(() => {
        if (!selectedRepo) {
            setCreateErrorMsg("Please select a repository");
            return;
        }

        const newProjectArgs: CreateConfigurationArgs = {
            // leave the name empty to let the backend generate the name
            name: "",
            cloneUrl: selectedRepo.url,
        };

        createConfiguration.mutate(newProjectArgs, {
            onSuccess: onCreated,
        });
    }, [createConfiguration, onCreated, selectedRepo, setCreateErrorMsg]);

    const errorMessage =
        createErrorMsg ||
        (createConfiguration.isError &&
            (createConfiguration.error?.message ?? "There was a problem importing your repository"));

    return (
        <Modal visible onClose={onClose} onSubmit={handleSubmit}>
            <ModalHeader>Add a repository</ModalHeader>
            <ModalBody>
                <div className="w-112 max-w-full">
                    {needsGitAuth ? (
                        <AuthorizeGit />
                    ) : (
                        <>
                            <InputField className="mb-8 w-full">
                                <RepositoryFinder
                                    selectedContextURL={selectedRepo?.url}
                                    selectedConfigurationId={selectedRepo?.projectId}
                                    onChange={setSelectedRepo}
                                    excludeConfigurations
                                />
                            </InputField>
                        </>
                    )}
                </div>
            </ModalBody>
            <ModalFooter
                alert={
                    errorMessage && (
                        <ModalFooterAlert type="danger" onClose={() => setCreateErrorMsg("")}>
                            {errorMessage}
                        </ModalFooterAlert>
                    )
                }
            >
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={createConfiguration.isLoading}>
                    Add
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
