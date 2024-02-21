/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../components/Modal";
import RepositoryFinder from "../../components/RepositoryFinder";
import { InputField } from "../../components/forms/InputField";
import { AuthorizeGit, useNeedsGitAuthorization } from "../../components/AuthorizeGit";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Button } from "@podkit/buttons/Button";
import { useTriggerPrebuildQuery } from "../../data/prebuilds/prebuild-queries";
import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { Link } from "react-router-dom";
import { repositoriesRoutes } from "../../repositories/repositories.routes";

type Props = {
    defaultRepositoryId?: string;
    onRun: (prebuildId: string) => void;
    onClose: () => void;
};
export const RunPrebuildModal: FC<Props> = ({ defaultRepositoryId: defaultConfigurationId, onClose, onRun }) => {
    const needsGitAuth = useNeedsGitAuthorization();
    const [selectedRepo, setSelectedRepo] = useState<SuggestedRepository>();
    const [createErrorMsg, setCreateErrorMsg] = useState<JSX.Element | undefined>();
    const configurationId = useMemo(
        () => selectedRepo?.configurationId ?? defaultConfigurationId,
        [defaultConfigurationId, selectedRepo?.configurationId],
    );

    const {
        isFetching,
        refetch: startPrebuild,
        isError,
        error,
        isRefetching,
        data: prebuildId,
    } = useTriggerPrebuildQuery(configurationId);

    const { data: configuration } = useConfiguration(configurationId ?? "");

    const handleSubmit = useCallback(() => {
        if (!configurationId) {
            setCreateErrorMsg(<>Please select a repository</>);
            return;
        }

        if (!configuration?.prebuildSettings?.enabled) {
            if (configuration?.id)
                setCreateErrorMsg(
                    <>
                        Prebuilds have to be enabled for this repository. Enable them in the{" "}
                        <Link to={repositoriesRoutes.PrebuildsSettings(configuration.id)}>Prebuild settings</Link>{" "}
                        first.
                    </>,
                );
            return;
        }

        startPrebuild();
    }, [configuration, configurationId, startPrebuild]);

    const errorMessage = createErrorMsg || (isError && (error?.message ?? "There was a problem running the prebuild"));

    if (prebuildId) {
        onRun(prebuildId);
        onClose();
    }

    return (
        <Modal visible onClose={onClose} onSubmit={handleSubmit}>
            <ModalHeader>Run a prebuild</ModalHeader>
            <ModalBody>
                <div className="w-112 max-w-full">
                    {needsGitAuth ? (
                        <AuthorizeGit />
                    ) : (
                        <>
                            <InputField className="mb-8 w-full">
                                <RepositoryFinder
                                    selectedContextURL={selectedRepo?.url}
                                    selectedConfigurationId={configurationId}
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
                        <ModalFooterAlert type="danger" onClose={() => setCreateErrorMsg(undefined)}>
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
