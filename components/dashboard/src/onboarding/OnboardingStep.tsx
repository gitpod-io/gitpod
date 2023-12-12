/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, FormEvent, useCallback } from "react";
import Alert from "../components/Alert";
import { Button, ButtonProps } from "@podkit/buttons/Button";
import { Heading2, Subheading } from "../components/typography/headings";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

type Props = {
    title: string;
    subtitle: string;
    isValid: boolean;
    isSaving?: boolean;
    error?: string;
    onSubmit(): void;
    submitButtonText?: string;
    submitButtonType?: ButtonProps["variant"];
    onCancel?(): void;
    cancelButtonText?: string;
    cancelButtonType?: ButtonProps["variant"];
};
export const OnboardingStep: FC<Props> = ({
    title,
    subtitle,
    isValid,
    isSaving = false,
    error,
    children,
    onSubmit,
    submitButtonText,
    submitButtonType,
    onCancel,
    cancelButtonText,
    cancelButtonType,
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
            {/* Intentionally adjusting the size of the heading here */}
            <Heading2 className="text-4xl">{title}</Heading2>
            <Subheading>{subtitle}</Subheading>

            <form className="mt-8 mb-14 max-w-lg" onSubmit={handleSubmit}>
                {/* Form contents provided as children */}
                {children}

                {error && <Alert type="error">{error}</Alert>}

                <div className={"mt-4" + (onCancel ? " flex space-x-2" : "")}>
                    {onCancel && (
                        <Button
                            type="button"
                            variant={cancelButtonType || "secondary"}
                            disabled={isSaving}
                            onClick={onCancel}
                        >
                            {cancelButtonText || "Cancel"}
                        </Button>
                    )}
                    <LoadingButton
                        type="submit"
                        variant={submitButtonType || "default"}
                        disabled={!isValid || isSaving}
                        size="full-width"
                        loading={isSaving}
                    >
                        {submitButtonText || "Continue"}
                    </LoadingButton>
                </div>
            </form>
        </div>
    );
};
