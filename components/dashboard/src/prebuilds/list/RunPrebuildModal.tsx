/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
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
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Button } from "@podkit/buttons/Button";
import { useTriggerPrebuildQuery } from "../../data/prebuilds/prebuild-queries";

type Props = {
    onRun: (prebuildId: string) => void;
    onClose: () => void;
};

export const RunPrebuildModal: FC<Props> = ({ onClose, onRun }) => {
    const needsGitAuth = useNeedsGitAuthorization();
    const [selectedRepo, setSelectedRepo] = useState<SuggestedRepository>();
    const [createErrorMsg, setCreateErrorMsg] = useTemporaryState("", 3000);

    const {
        isFetching,
        refetch: startPrebuild,
        isError,
        error,
        isRefetching,
        data: prebuildId,
    } = useTriggerPrebuildQuery(selectedRepo?.projectId);

    const handleSubmit = useCallback(() => {
        if (!selectedRepo) {
            setCreateErrorMsg("Please select a repository");
            return;
        }

        startPrebuild();
    }, [selectedRepo, setCreateErrorMsg, startPrebuild]);

    const errorMessage = createErrorMsg || (isError && (error?.message ?? "There was a problem running the prebuild"));

    if (prebuildId) {
        onRun(prebuildId);
        onClose();
    }

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
                                    onlyProjects
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
                <LoadingButton type="submit" loading={isFetching || isRefetching}>
                    Run prebuild
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
