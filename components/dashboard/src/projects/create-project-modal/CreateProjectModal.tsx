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
import { useToast } from "../../components/toasts/Toasts";
import { InputField } from "../../components/forms/InputField";
import { Subheading } from "../../components/typography/headings";
import { AuthorizeGit, useNeedsGitAuthorization } from "../../components/AuthorizeGit";

type Props = {
    onCreated: (project: Project) => void;
    onClose: () => void;
};

export const CreateProjectModal: FC<Props> = ({ onClose, onCreated }) => {
    const needsGitAuth = useNeedsGitAuthorization();
    const [selectedRepo, setSelectedRepo] = useState<SuggestedRepository>();
    const createProject = useCreateProject();
    const { toast } = useToast();

    const handleSubmit = useCallback(() => {
        if (!selectedRepo) {
            toast("Please select a repository");
            return;
        }

        const projectName = selectedRepo.repositoryName || selectedRepo.projectName || selectedRepo.url;

        const newProjectArgs: CreateProjectArgs = {
            name: projectName,
            slug: projectName,
            cloneUrl: selectedRepo.url,
            // TODO: do we still need this?
            appInstallationId: "",
        };

        createProject.mutate(newProjectArgs, {
            onSuccess: onCreated,
        });
    }, [createProject, onCreated, selectedRepo, toast]);

    return (
        <Modal visible onClose={onClose} onSubmit={handleSubmit}>
            <ModalHeader>New Project</ModalHeader>
            <ModalBody>
                {/* TODO: encapsulate this into a sub component */}
                {needsGitAuth ? (
                    <AuthorizeGit />
                ) : (
                    <>
                        <Subheading className="text-center">
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
                        <InputField label="Repository">
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
            <ModalFooter
                alert={
                    createProject.isError && (
                        <ModalFooterAlert type="danger">
                            {createProject.error.message || "There was a problem creating your project"}
                        </ModalFooterAlert>
                    )
                }
            >
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
