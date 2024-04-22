/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, ReactNode, useCallback, useState } from "react";
import SelectIDEComponent from "../components/SelectIDEComponent";
import { ThemeSelector } from "../components/ThemeSelector";
import { Heading2, Subheading } from "../components/typography/headings";
import { OnboardingStep } from "./OnboardingStep";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import Alert from "../components/Alert";

type Props = {
    user: User;
    onComplete(ide: string, useLatest: boolean): void;
};
export const StepPersonalize: FC<Props> = ({ user, onComplete }) => {
    const [ide, setIDE] = useState(user?.editorSettings?.name || "code");
    const [useLatest, setUseLatest] = useState(user?.editorSettings?.version === "latest");
    const [ideWarning, setIdeWarning] = useState<ReactNode | undefined>(undefined);

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
            {ideWarning && (
                // We set a max width so that the layout does not shift when the warning is displayed.
                <Alert type="warning" className="my-2 max-w-[28.5rem]">
                    <span className="text-sm">{ideWarning}</span>
                </Alert>
            )}
            <SelectIDEComponent
                onSelectionChange={(ide, latest) => {
                    setIDE(ide);
                    setUseLatest(latest);
                }}
                setWarning={setIdeWarning}
                ignoreRestrictionScopes={["configuration", "organization"]}
                selectedIdeOption={ide}
                useLatest={useLatest}
                hideVersions
            />

            <ThemeSelector className="mt-4" />
        </OnboardingStep>
    );
};
