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
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { Delayed } from "../components/Delayed";
import { SpinnerLoader } from "../components/Loader";
import { OrganizationInfo } from "../data/organizations/orgs-query";
import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";

const DedicatedSetup: FC = () => {
    const currentOrg = useCurrentOrg();
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

    if (currentOrg.isLoading || oidcClients.isLoading) {
        return (
            <Delayed>
                <SpinnerLoader />
            </Delayed>
        );
    }

    // Delay rendering until we have data so we can default to the correct step
    return <DedicatedSetupSteps org={currentOrg.data} config={ssoConfig} />;
};

export default DedicatedSetup;

const STEPS = {
    GETTING_STARTED: "getting-started",
    ORG_NAMING: "org-naming",
    SSO_SETUP: "sso-setup",
    COMPLETE: "complete",
} as const;
type StepsValue = typeof STEPS[keyof typeof STEPS];

type DedicatedSetupStepsProps = {
    org?: OrganizationInfo;
    config?: OIDCClientConfig;
};
const DedicatedSetupSteps: FC<DedicatedSetupStepsProps> = ({ org, config }) => {
    const { dropConfetti } = useConfetti();
    const history = useHistory();

    // If we have an org name, we can skip the first step
    const initialStep = org && org.name ? STEPS.SSO_SETUP : STEPS.GETTING_STARTED;
    const [step, setStep] = useState<StepsValue>(initialStep);

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
        <>
            {step === STEPS.GETTING_STARTED && <GettingStartedStep onComplete={() => setStep(STEPS.ORG_NAMING)} />}
            {step === STEPS.ORG_NAMING && <OrgNamingStep onComplete={() => setStep(STEPS.SSO_SETUP)} />}
            {step === STEPS.SSO_SETUP && <SSOSetupStep config={config} onComplete={handleSetupComplete} />}
            {step === STEPS.COMPLETE && <SetupCompleteStep onComplete={handleEndSetup} />}
        </>
    );
};
