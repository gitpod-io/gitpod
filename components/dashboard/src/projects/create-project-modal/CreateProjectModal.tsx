/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import { Button } from "../../components/Button";
import { CreateProjectArgs, useCreateProject } from "../../data/projects/create-project-mutation";
import { Project, SuggestedRepository } from "@gitpod/gitpod-protocol";
import RepositoryFinder from "../../components/RepositoryFinder";
import { InputField } from "../../components/forms/InputField";
import { Subheading } from "../../components/typography/headings";
import { AuthorizeGit, useNeedsGitAuthorization } from "../../components/AuthorizeGit";
import { useTemporaryState } from "../../hooks/use-temporary-value";

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
                {/* TODO: encapsulate this into a sub component */}
                {needsGitAuth ? (
                    <AuthorizeGit />
                ) : (
                    <>
                        <Subheading className="text-center mb-8">
                            Projects allow you to manage prebuilds and workspaces for your repository.{" "}
                            <a
                                href="https://www.gitpod.io/docs/configure/projects"
                                target="_blank"
                                rel="noreferrer"
                                className="gp-link"
                            >
                                Learn more
                            </a>
                        </Subheading>
                        <InputField label="Repository" className="mb-8">
                            <RepositoryFinder
                                selectedContextURL={selectedRepo?.url}
                                selectedProjectID={selectedRepo?.projectId}
                                onChange={setSelectedRepo}
                                excludeProjects
                            />
                        </InputField>
                    </>
                )}
            </ModalBody>
            <ModalFooter alert={errorMessage && <ModalFooterAlert type="danger">{errorMessage}</ModalFooterAlert>}>
                <Button type="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button htmlType="submit" loading={createProject.isLoading}>
                    Create
                </Button>
            </ModalFooter>
        </Modal>
    );
};
