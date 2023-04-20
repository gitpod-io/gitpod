/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";
import { Button } from "./components/Button";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "./components/Modal";
import { OIDCClientConfigModal } from "./teams/sso/OIDCClientConfigModal";

type Props = {
    onComplete?: () => void;
};
export default function DedicatedOnboarding({ onComplete }: Props) {
    const [showModal] = useState<boolean>(false);

    const acceptAndContinue = useCallback(() => {
        // // setShowModal(true);
    }, []);

    // const onAuthorize = useCallback(
    //     (payload?: string) => {
    //         onComplete && onComplete();

    //         // run without await, so the integrated closing of new tab isn't blocked
    //         (async () => {
    //             window.location.href = gitpodHostUrl.asDashboard().toString();
    //         })();
    //     },
    //     [onComplete],
    // );

    return (
        <div>
            {!showModal && (
                <Modal visible={true} onClose={() => {}} closeable={false}>
                    <ModalHeader>Welcome to Gitpod Dedicated 🚀</ModalHeader>
                    <ModalBody>
                        <p className="pb-4 text-gray-500 text-base">
                            Before this instance can be used, you need to set up Single Sign-on.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button className={"ml-2"} onClick={acceptAndContinue}>
                            Continue
                        </Button>
                    </ModalFooter>
                </Modal>
            )}
            {showModal && <OIDCClientConfigModal onClose={() => {}} />}
        </div>
    );
}
