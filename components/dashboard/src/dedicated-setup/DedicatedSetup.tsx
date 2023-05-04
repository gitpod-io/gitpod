/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useContext, useMemo, useState } from "react";
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
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";

type Props = {
    onComplete: () => void;
};
const DedicatedSetup: FC<Props> = ({ onComplete }) => {
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

    if (currentOrg.isLoading) {
        return (
            <Delayed>
                <SpinnerLoader />
            </Delayed>
        );
    }

    // Delay rendering until we have data so we can default to the correct step
    return <DedicatedSetupSteps org={currentOrg.data} ssoConfig={ssoConfig} onComplete={onComplete} />;
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
    ssoConfig?: OIDCClientConfig;
    onComplete: () => void;
};
const DedicatedSetupSteps: FC<DedicatedSetupStepsProps> = ({ org, ssoConfig, onComplete }) => {
    const { setUser } = useContext(UserContext);

    // If we have an org w/ a name, we can skip the first step and go to sso setup
    let initialStep: StepsValue = org && org.name ? STEPS.SSO_SETUP : STEPS.GETTING_STARTED;
    // If there's already an active sso config, advance to the complete step
    if (ssoConfig?.active) {
        initialStep = STEPS.COMPLETE;
    }
    const [step, setStep] = useState<StepsValue>(initialStep);
    const history = useHistory();
    const { dropConfetti } = useConfetti();

    const handleSetupComplete = useCallback(() => {
        // celebrate 🎉
        dropConfetti();
        // Transition to completed view
        setStep(STEPS.COMPLETE);
    }, [dropConfetti]);

    const updateUser = useCallback(async () => {
        await getGitpodService().reconnect();
        const user = await getGitpodService().server.getLoggedInUser();
        setUser(user);
    }, [setUser]);

    const handleEndSetup = useCallback(async () => {
        await updateUser();
        history.push(`/settings/git?org=${org?.id}`);
        onComplete();
    }, [history, onComplete, updateUser, org?.id]);

    return (
        <>
            {step === STEPS.GETTING_STARTED && <GettingStartedStep onComplete={() => setStep(STEPS.ORG_NAMING)} />}
            {step === STEPS.ORG_NAMING && <OrgNamingStep onComplete={() => setStep(STEPS.SSO_SETUP)} />}
            {step === STEPS.SSO_SETUP && <SSOSetupStep config={ssoConfig} onComplete={handleSetupComplete} />}
            {step === STEPS.COMPLETE && <SetupCompleteStep onComplete={handleEndSetup} />}
        </>
    );
};
