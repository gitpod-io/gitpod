/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, FormEvent, useCallback } from "react";
import Alert from "../components/Alert";
import { Button } from "../components/Button";
import { Heading1, Subheading } from "../components/typography/headings";

type Props = {
    title: string;
    subtitle: string;
    isValid: boolean;
    isSaving?: boolean;
    error?: string;
    onSubmit(): void;
};
export const OnboardingStep: FC<Props> = ({
    title,
    subtitle,
    isValid,
    isSaving = false,
    error,
    children,
    onSubmit,
}) => {
    const handleSubmit = useCallback(
        async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (isSaving || !isValid) {
                return;
            }

            onSubmit();
        },
        [isSaving, isValid, onSubmit],
    );

    return (
        <div className="flex flex-col items-center justify-center max-w-full">
            <Heading1>{title}</Heading1>
            <Subheading>{subtitle}</Subheading>

            <form className="mt-8 mb-14 max-w-lg" onSubmit={handleSubmit}>
                {/* Form contents provided as children */}
                {children}

                {error && <Alert type="error">{error}</Alert>}

                <div className="mt-8">
                    <Button htmlType="submit" disabled={!isValid || isSaving} size="block">
                        Continue
                    </Button>
                </div>
            </form>
        </div>
    );
};
