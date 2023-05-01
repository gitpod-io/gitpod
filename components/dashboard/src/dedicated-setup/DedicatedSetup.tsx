/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo, useState } from "react";
import { GettingStartedStep } from "./GettingStartedStep";
import { OrgNamingStep } from "./OrgNamingStep";
import { SSOSetupStep } from "./SSOSetupStep";
import { useConfetti } from "../contexts/ConfettiContext";
import { SetupCompleteStep } from "./SetupCompleteStep";
import { useHistory } from "react-router";
import { useOIDCClientsQuery } from "../data/oidc-clients/oidc-clients-query";

const STEPS = {
    GETTING_STARTED: "getting-started",
    ORG_NAMING: "org-naming",
    SSO_SETUP: "sso-setup",
    COMPLETE: "complete",
} as const;
type StepsValue = typeof STEPS[keyof typeof STEPS];

type Props = {
    onComplete?: () => void;
};
const DedicatedSetup: FC<Props> = ({ onComplete }) => {
    const { dropConfetti } = useConfetti();
    // TODO: try and determine what step we should start on based on current state, i.e. org/sso already exists
    const [step, setStep] = useState<StepsValue>(STEPS.GETTING_STARTED);
    const history = useHistory();

    const oidcClients = useOIDCClientsQuery();

    // if a config already exists, select first active, or first config
    const ssoConfig = useMemo(() => {
        if (!oidcClients.data) {
            return;
        }

        const activeConfig = (oidcClients.data || []).find((c) => c.active);
        if (activeConfig) {
            return activeConfig;
        }

        return oidcClients.data?.[0];
    }, [oidcClients.data]);

    const handleSetupComplete = useCallback(() => {
        // celebrate 🎉
        dropConfetti();
        // Transition to completed view
        setStep(STEPS.COMPLETE);
    }, [dropConfetti]);

    const handleEndSetup = useCallback(() => {
        history.push("/settings/git");
    }, [history]);

    return (
        // TODO: Should we shift SetupLayout to render at this level?
        <>
            {step === STEPS.GETTING_STARTED && <GettingStartedStep onComplete={() => setStep(STEPS.ORG_NAMING)} />}
            {step === STEPS.ORG_NAMING && <OrgNamingStep onComplete={() => setStep(STEPS.SSO_SETUP)} />}
            {step === STEPS.SSO_SETUP && <SSOSetupStep config={ssoConfig} onComplete={handleSetupComplete} />}
            {step === STEPS.COMPLETE && <SetupCompleteStep onComplete={handleEndSetup} />}
        </>
    );
};

export default DedicatedSetup;
