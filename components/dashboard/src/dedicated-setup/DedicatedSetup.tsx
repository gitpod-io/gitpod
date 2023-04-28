/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { GettingStartedStep } from "./GettingStartedStep";
import { OrgNamingStep } from "./OrgNamingStep";
import { SSOSetupStep } from "./SSOSetupStep";
import { useConfetti } from "../contexts/ConfettiContext";
import { SetupCompleteStep } from "./SetupCompleteStep";
import { useHistory } from "react-router";

const STEPS = {
    GETTING_STARTED: "getting-started",
    ORG_NAMING: "org-naming",
    SSO_SETUP: "sso-setup",
    COMPLETE: "complete",
};

type Props = {
    onComplete?: () => void;
};
const DedicatedSetup: FC<Props> = ({ onComplete }) => {
    const { dropConfetti } = useConfetti();
    // TODO: try and determine what step we should start on based on current state, i.e. org/sso already exists
    const [step, setStep] = useState<typeof STEPS[keyof typeof STEPS]>(STEPS.GETTING_STARTED);
    const history = useHistory();

    // useEffect(() => {
    //     document.body.classList.add("honeycomb-bg");

    //     return () => {
    //         document.body.classList.remove("honeycomb-bg");
    //     };
    // }, []);

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
            {step === STEPS.SSO_SETUP && <SSOSetupStep onComplete={handleSetupComplete} />}
            {step === STEPS.COMPLETE && <SetupCompleteStep onComplete={handleEndSetup} />}
        </>
    );
};

export default DedicatedSetup;
