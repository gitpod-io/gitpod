/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import SelectIDEComponent from "../components/SelectIDEComponent";
import { ThemeSelector } from "../components/ThemeSelector";
import { Heading2, Subheading } from "../components/typography/headings";
import { OnboardingStep } from "./OnboardingStep";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";

type Props = {
    user: User;
    onComplete(ide: string, useLatest: boolean): void;
};
export const StepPersonalize: FC<Props> = ({ user, onComplete }) => {
    const [ide, setIDE] = useState(user?.editorSettings?.name || "code");
    const [useLatest, setUseLatest] = useState(user?.editorSettings?.version === "latest");

    // This step doesn't save the ide selection yet (happens at the end), just passes them along
    const handleSubmitted = useCallback(() => {
        onComplete(ide, useLatest);
    }, [ide, onComplete, useLatest]);

    const isValid = !!ide;

    return (
        <OnboardingStep
            title="How are you going to use Gitpod?"
            subtitle="We will tailor your experience based on your preferences."
            isValid={isValid}
            onSubmit={handleSubmitted}
        >
            <Heading2>Choose an editor</Heading2>
            <Subheading className="mb-2">You can change this later in your user preferences.</Subheading>
            <SelectIDEComponent
                onSelectionChange={(ide, latest) => {
                    setIDE(ide);
                    setUseLatest(latest);
                }}
                ignoreRestrictionScopes={["configuration", "organization"]}
                selectedIdeOption={ide}
                useLatest={useLatest}
            />

            <ThemeSelector className="mt-4" />
        </OnboardingStep>
    );
};
