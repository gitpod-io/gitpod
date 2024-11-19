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
import { useTriggerPrebuildMutation } from "../../data/prebuilds/prebuild-queries";
import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { Link } from "react-router-dom";
import { repositoriesRoutes } from "../../repositories/repositories.routes";
import { TextInputField } from "../../components/forms/TextInputField";
import { ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";

type Props = {
    defaultRepositoryId?: string;
    onRun: (prebuildId: string) => void;
    onClose: () => void;
};
export const RunPrebuildModal: FC<Props> = ({ defaultRepositoryId: defaultConfigurationId, onClose, onRun }) => {
    const needsGitAuth = useNeedsGitAuthorization();
    const [selectedRepo, setSelectedRepo] = useState<SuggestedRepository>();
    const [branchName, setBranchName] = useState<string>();

    const [createErrorMsg, setCreateErrorMsg] = useState<JSX.Element | undefined>();
    const configurationId = useMemo(
        () => selectedRepo?.configurationId ?? defaultConfigurationId,
        [defaultConfigurationId, selectedRepo?.configurationId],
    );

    const triggerPrebuildMutation = useTriggerPrebuildMutation(configurationId, branchName);
    const [isTriggeringNewPrebuild, setTriggeringNewPrebuild] = useState(false);
    const triggerPrebuild = useCallback(async () => {
        try {
            setTriggeringNewPrebuild(true);
            await triggerPrebuildMutation.mutateAsync(undefined, {
                onSuccess: (newPrebuildId) => {
                    onRun(newPrebuildId);
                    onClose();
                },
                onError: (error) => {
                    if (error instanceof ApplicationError) {
                        setCreateErrorMsg(<>Failed to trigger prebuild: {error.message}</>);
                    }
                },
                onSettled: () => {
                    setTriggeringNewPrebuild(false);
                },
            });
        } catch (error) {
            console.error("Could not trigger prebuild", error);
        }
    }, [onClose, onRun, triggerPrebuildMutation]);

    const { data: configuration } = useConfiguration(configurationId);

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
                        <Link className="underline" to={repositoriesRoutes.PrebuildsSettings(configuration.id)}>
                            Prebuild settings
                        </Link>{" "}
                        first.
                    </>,
                );
            return;
        }

        triggerPrebuild();
    }, [configuration, configurationId, triggerPrebuild]);

    return (
        <Modal visible onClose={onClose} onSubmit={handleSubmit}>
            <ModalHeader>Run a prebuild</ModalHeader>
            <ModalBody>
                <div className="w-112 max-w-full flex flex-col">
                    {needsGitAuth ? (
                        <AuthorizeGit />
                    ) : (
                        <>
                            <InputField className="w-full">
                                <RepositoryFinder
                                    selectedContextURL={selectedRepo?.url}
                                    selectedConfigurationId={configurationId}
                                    onChange={setSelectedRepo}
                                    onlyConfigurations
                                />
                            </InputField>
                            <TextInputField
                                label="Branch"
                                hint={
                                    <>
                                        Leaving this blank will result in running your prebuild on the repository's
                                        default branch.
                                    </>
                                }
                                value={branchName}
                                onChange={setBranchName}
                                disabled={isTriggeringNewPrebuild}
                            />
                        </>
                    )}
                </div>
            </ModalBody>
            <ModalFooter
                alert={
                    createErrorMsg && (
                        <ModalFooterAlert type="danger" onClose={() => setCreateErrorMsg(undefined)}>
                            {createErrorMsg}
                        </ModalFooterAlert>
                    )
                }
            >
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={isTriggeringNewPrebuild}>
                    Run prebuild
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
