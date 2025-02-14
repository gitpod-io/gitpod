/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Button } from "@podkit/buttons/Button";
import { Heading1, Heading2, Heading3, Subheading } from "@podkit/typography/Headings";
import Markdown from "react-markdown";
import { useOrgSettingsQuery } from "../../data/organizations/org-settings-query";
import { gitpodWelcomeSubheading } from "./WelcomeMessageConfigurationField";

type Props = {
    disabled?: boolean;
    hideHeader?: boolean;
    setWelcomeMessageEditorOpen?: (open: boolean) => void;
};
export const WelcomeMessagePreview = ({ disabled, setWelcomeMessageEditorOpen, hideHeader }: Props) => {
    const { data: settings } = useOrgSettingsQuery();
    const avatarUrl = settings?.onboardingSettings?.welcomeMessage?.featuredMemberResolvedAvatarUrl;
    const welcomeMessage = settings?.onboardingSettings?.welcomeMessage?.message;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex justify-between gap-2 items-center">
                {!hideHeader && <Heading2 className="py-6">Welcome to Gitpod</Heading2>}
                {setWelcomeMessageEditorOpen && (
                    <Button variant="secondary" onClick={() => setWelcomeMessageEditorOpen(true)} disabled={disabled}>
                        Edit
                    </Button>
                )}
            </div>
            <Subheading>{gitpodWelcomeSubheading}</Subheading>
            {welcomeMessage && (
                <article className="p-8 my-4 bg-pk-surface-secondary text-pk-content-primary rounded-xl flex flex-col gap-5 items-center justify-center">
                    {avatarUrl && <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full" />}
                    <Markdown
                        className="space-y-4 text-center bg-pk-surface-secondary"
                        components={{
                            ul: ({ children }) => <ul className="list-disc list-inside">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside">{children}</ol>,
                            img: ({ src, alt }) => <img src={src} alt={alt} className="w-full rounded-lg" />,
                            h1: ({ children }) => <Heading1 className="text-left text-2xl">{children}</Heading1>,
                            h2: ({ children }) => <Heading2 className="text-left text-xl">{children}</Heading2>,
                            h3: ({ children }) => <Heading3 className="text-left text-lg">{children}</Heading3>,
                        }}
                    >
                        {welcomeMessage}
                    </Markdown>
                </article>
            )}
        </div>
    );
};
