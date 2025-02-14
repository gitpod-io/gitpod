/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OnboardingSettings_WelcomeMessage } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Button } from "@podkit/buttons/Button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../components/Modal";
import { storageAvailable } from "../../utils";
import { WelcomeMessagePreview } from "./WelcomeMessagePreview";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";

type Props = {
    user: User;
    welcomeMessage: OnboardingSettings_WelcomeMessage;
};
export const OrganizationJoinModal = ({ welcomeMessage, user }: Props) => {
    const initialOrgOnboardingPending = useMemo(() => {
        if (!storageAvailable("localStorage")) {
            return false;
        }

        const alreadyOnboarded = localStorage.getItem("newUserOnboardingDone") === "true";
        if (alreadyOnboarded) {
            return false;
        }

        // We want to show this message to users who just signed up, so we select the "new-ish" users here
        const oneWeekSeconds = 7 * 24 * 60 * 60;
        const userCreatedWithinLast7Days =
            user.createdAt && user.createdAt.seconds >= Date.now() / 1000 - oneWeekSeconds;
        return userCreatedWithinLast7Days;
    }, [user.createdAt]);
    const dismissOrgOnboarding = useCallback(() => {
        if (storageAvailable("localStorage")) {
            localStorage.setItem("newUserOnboardingDone", "true");
        }

        setOrgOnboardingPending(false);
    }, []);
    const [orgOnboardingPending, setOrgOnboardingPending] = useState(initialOrgOnboardingPending ?? false);

    // if the org-wide welcome message is not enabled, prevent showing it in the future
    useEffect(() => {
        if (!welcomeMessage.enabled) {
            dismissOrgOnboarding();
        }
    }, [welcomeMessage.enabled, dismissOrgOnboarding]);

    if (!welcomeMessage.enabled || !orgOnboardingPending) {
        return null;
    }

    return (
        <Modal
            visible={orgOnboardingPending}
            onClose={dismissOrgOnboarding}
            containerClassName="min-[576px]:max-w-[650px]"
        >
            <ModalHeader>Welcome to Gitpod</ModalHeader>
            <ModalBody>
                <WelcomeMessagePreview hideHeader />
            </ModalBody>
            <ModalFooter>
                <Button onClick={dismissOrgOnboarding}>Get Started</Button>
            </ModalFooter>
        </Modal>
    );
};
