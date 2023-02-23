/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, FormEvent, useCallback } from "react";
import Alert from "../components/Alert";

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
            <h1>{title}</h1>
            <p>{subtitle}</p>

            <form className="my-8 max-w-lg" onSubmit={handleSubmit}>
                {/* Form contents provided as children */}
                {children}

                {error && <Alert type="error">{error}</Alert>}

                <div>
                    <button type="submit" disabled={!isValid || isSaving} className="w-full mt-8">
                        Continue
                    </button>
                </div>
            </form>
        </div>
    );
};
