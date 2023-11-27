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
import { useOIDCClientsQuery } from "../data/oidc-clients/oidc-clients-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { SpinnerLoader } from "../components/Loader";
import { getGitpodService } from "../service/service";
import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { useQueryParams } from "../hooks/use-query-params";
import { useDocumentTitle } from "../hooks/use-document-title";
import { forceDedicatedSetupParam } from "./use-show-dedicated-setup";
import { Organization } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Delayed } from "@podkit/loading/Delayed";
import { useAuthenticatedUser } from "../data/current-user/authenticated-user-query";

type Props = {
    onComplete: () => void;
};
const DedicatedSetup: FC<Props> = ({ onComplete }) => {
    useDocumentTitle("Welcome");
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

    // let current org load along with oidc clients once we have an org
    if (currentOrg.isLoading || (currentOrg.data && oidcClients.isLoading)) {
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
    org?: Organization;
    ssoConfig?: OIDCClientConfig;
    onComplete: () => void;
};
const DedicatedSetupSteps: FC<DedicatedSetupStepsProps> = ({ org, ssoConfig, onComplete }) => {
    const { refetch: reloadUser } = useAuthenticatedUser();
    const params = useQueryParams();

    // If we have an org w/ a name, we can skip the first step and go to sso setup
    let initialStep: StepsValue = org && org.name ? STEPS.SSO_SETUP : STEPS.GETTING_STARTED;
    // If there's already an active sso config, advance to the complete step
    if (ssoConfig?.active) {
        initialStep = STEPS.COMPLETE;
    }

    // If setup forced via params, just start at beginning
    const forceSetup = forceDedicatedSetupParam(params);
    const [step, setStep] = useState<StepsValue>(forceSetup ? STEPS.GETTING_STARTED : initialStep);
    const { dropConfetti } = useConfetti();

    const handleSetupComplete = useCallback(() => {
        // celebrate 🎉
        dropConfetti();
        // Transition to completed view
        setStep(STEPS.COMPLETE);
    }, [dropConfetti]);

    const updateUser = useCallback(async () => {
        await getGitpodService().reconnect();
        await reloadUser();
    }, [reloadUser]);

    const handleEndSetup = useCallback(async () => {
        await updateUser();
        onComplete();
    }, [onComplete, updateUser]);

    return (
        <>
            {step === STEPS.GETTING_STARTED && (
                <GettingStartedStep
                    progressCurrent={0}
                    progressTotal={2}
                    onComplete={() => setStep(STEPS.ORG_NAMING)}
                />
            )}
            {step === STEPS.ORG_NAMING && (
                <OrgNamingStep progressCurrent={1} progressTotal={2} onComplete={() => setStep(STEPS.SSO_SETUP)} />
            )}
            {step === STEPS.SSO_SETUP && (
                <SSOSetupStep
                    progressCurrent={2}
                    progressTotal={2}
                    config={ssoConfig}
                    onComplete={handleSetupComplete}
                />
            )}
            {step === STEPS.COMPLETE && <SetupCompleteStep onComplete={handleEndSetup} />}
        </>
    );
};
