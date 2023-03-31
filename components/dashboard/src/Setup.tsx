/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "./components/Button";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./components/Modal";
import { getGitpodService, gitpodHostUrl } from "./service/service";
import { GitIntegrationModal } from "./user-settings/Integrations";

type Props = {
    onComplete?: () => void;
};
export default function Setup({ onComplete }: Props) {
    const [showModal, setShowModal] = useState<boolean>(false);

    useEffect(() => {
        (async () => {
            const dynamicAuthProviders = await getGitpodService().server.getOwnAuthProviders();
            const previous = dynamicAuthProviders.filter((ap) => ap.ownerId === "no-user")[0];
            if (previous) {
                await getGitpodService().server.deleteOwnAuthProvider({ id: previous.id });
            }
        })();
    }, []);

    const acceptAndContinue = useCallback(() => {
        setShowModal(true);
    }, []);

    const onAuthorize = useCallback(
        (payload?: string) => {
            onComplete && onComplete();

            // run without await, so the integrated closing of new tab isn't blocked
            (async () => {
                window.location.href = gitpodHostUrl.asDashboard().toString();
            })();
        },
        [onComplete],
    );

    const headerText = "Configure a Git integration with a GitLab, GitHub, or Bitbucket instance.";

    return (
        <div>
            {!showModal && (
                // TODO: Use title and buttons props
                <Modal visible={true} onClose={() => {}} closeable={false}>
                    <ModalHeader>Welcome to Gitpod 🎉</ModalHeader>
                    <ModalBody>
                        <p className="pb-4 text-gray-500 text-base">
                            To start using Gitpod, you will need to set up a Git integration.
                        </p>

                        <div className="flex">
                            <span className="text-gray-500">
                                By using Gitpod, you agree to our{" "}
                                <a
                                    className="gp-link"
                                    target="gitpod-terms"
                                    href="https://www.gitpod.io/self-hosted-terms/"
                                >
                                    terms
                                </a>
                                .
                            </span>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button className={"ml-2"} onClick={acceptAndContinue}>
                            Continue
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
            {showModal && (
                <GitIntegrationModal
                    mode="new"
                    login={true}
                    headerText={headerText}
                    userId="no-user"
                    onAuthorize={onAuthorize}
                />
            )}
        </div>
    );
}
