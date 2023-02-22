/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useState } from "react";
import SelectIDEComponent from "../components/SelectIDEComponent";
import { ThemeSelector } from "../components/ThemeSelector";
import { OnboardingStep } from "./OnboardingStep";

type Props = {
    user: User;
    onComplete(user: User): void;
};
export const StepPersonalize: FC<Props> = ({ user, onComplete }) => {
    const [ide, setIDE] = useState(user?.additionalData?.ideSettings?.defaultIde || "code");
    const [useLatest, setUseLatest] = useState(user?.additionalData?.ideSettings?.useLatestVersion ?? false);

    const prepareUpdates = useCallback(() => {
        const additionalData = user.additionalData || {};
        const ideSettings = additionalData.ideSettings || {};

        return {
            additionalData: {
                ...additionalData,
                ideSettings: {
                    ...ideSettings,
                    settingVersion: "2.0",
                    defaultIde: ide,
                    useLatestVersion: useLatest,
                },
            },
        };
    }, [ide, useLatest, user.additionalData]);

    const isValid = !!ide;

    return (
        <OnboardingStep
            title="Personalize Gitpod"
            subtitle="Cusomize your experience"
            isValid={isValid}
            prepareUpdates={prepareUpdates}
            onUpdated={onComplete}
        >
            <h3>Choose an editor</h3>
            <p>You can change this later in your user preferences.</p>
            <SelectIDEComponent
                onSelectionChange={(ide, latest) => {
                    setIDE(ide);
                    setUseLatest(latest);
                }}
                selectedIdeOption={ide}
                useLatest={useLatest}
            />

            <ThemeSelector className="mt-4" />
        </OnboardingStep>
    );
};
