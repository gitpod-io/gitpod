/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { Button } from "@podkit/buttons/Button";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { CreateProjectArgs, useCreateProject } from "../../data/projects/create-project-mutation";
import { Project } from "@gitpod/gitpod-protocol";
import RepositoryFinder from "../../components/RepositoryFinder";
import { InputField } from "../../components/forms/InputField";
import { AuthorizeGit, useNeedsGitAuthorization } from "../../components/AuthorizeGit";
import { useTemporaryState } from "../../hooks/use-temporary-value";
import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";

type Props = {
    onCreated: (project: Project) => void;
    onClose: () => void;
};
export const CreateProjectModal: FC<Props> = ({ onClose, onCreated }) => {
    const needsGitAuth = useNeedsGitAuthorization();
    const [selectedRepo, setSelectedRepo] = useState<SuggestedRepository>();
    const createProject = useCreateProject();
    const [createErrorMsg, setCreateErrorMsg] = useTemporaryState("", 3000);

    const handleSubmit = useCallback(() => {
        if (!selectedRepo) {
            setCreateErrorMsg("Please select a repository");
            return;
        }

        const newProjectArgs: CreateProjectArgs = {
            // leave the name empty to let the backend generate the name
            name: "",
            // deprecated
            slug: "",
            cloneUrl: selectedRepo.url,
            appInstallationId: "",
        };

        createProject.mutate(newProjectArgs, {
            onSuccess: onCreated,
        });
    }, [createProject, onCreated, selectedRepo, setCreateErrorMsg]);

    const errorMessage =
        createErrorMsg ||
        (createProject.isError && (createProject.error?.message ?? "There was a problem creating your project"));

    return (
        <Modal visible onClose={onClose} onSubmit={handleSubmit}>
            <ModalHeader>New Project</ModalHeader>
            <ModalBody>
                <div className="w-112 max-w-full">
                    {needsGitAuth ? (
                        <AuthorizeGit />
                    ) : (
                        <>
                            <InputField label="Repository" className="mb-8 w-full">
                                <RepositoryFinder
                                    selectedContextURL={selectedRepo?.url}
                                    selectedConfigurationId={selectedRepo?.configurationId}
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
                <LoadingButton type="submit" loading={createProject.isLoading}>
                    Create
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
