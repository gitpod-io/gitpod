/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkButton } from "@podkit/buttons/LinkButton";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { StartWorkspaceModalKeyBinding } from "../App";
import { VideoSection } from "../onboarding/VideoSection";
import { trackVideoClick } from "../Analytics";
import { useInstallationConfiguration } from "../data/installation/installation-config-query";

export const EmptyWorkspacesContent = () => {
    const { data: installationConfig } = useInstallationConfiguration();
    const isDedicatedInstallation = !!installationConfig?.isDedicatedInstallation;

    const handlePlay = () => {
        trackVideoClick("create-new-workspace");
    };

    return (
        <div className="app-container flex flex-col space-y-2">
            <div className="px-6 mt-16 flex flex-col xl:flex-row items-center justify-center gap-x-14 gap-y-10 min-h-96 min-w-96">
                {isDedicatedInstallation ? (
                    <div className="flex flex-col items-center text-center justify-center">
                        <Heading2 className="!font-semibold !text-lg">No workspaces</Heading2>
                        <Subheading className="max-w-xs xl:text-left text-center">
                            Create a new workspace to start coding
                        </Subheading>
                        <div className="flex flex-col mt-4 w-fit">
                            <LinkButton href={"/new"} className="gap-1.5">
                                New Workspace{" "}
                                <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
                            </LinkButton>
                        </div>
                    </div>
                ) : (
                    <>
                        <VideoSection
                            metadataVideoTitle="Gitpod demo"
                            playbackId="m01BUvCkTz7HzQKFoIcQmK00Rx5laLLoMViWBstetmvLs"
                            poster="https://i.ytimg.com/vi_webp/1ZBN-b2cIB8/maxresdefault.webp"
                            playerProps={{ onPlay: handlePlay, defaultHiddenCaptions: true }}
                            className="w-[535px] rounded-xl"
                        />
                        <div className="flex flex-col items-center xl:items-start justify-center">
                            <Heading2 className="mb-4 !font-semibold !text-lg">Create your first workspace</Heading2>
                            <Subheading className="max-w-xs xl:text-left text-center">
                                Write code in your personal development environment that’s running in the cloud
                            </Subheading>
                            <span className="flex flex-col space-y-4 w-fit">
                                <LinkButton
                                    variant="secondary"
                                    className="mt-4 border !border-pk-content-invert-primary text-pk-content-secondary bg-pk-surface-secondary"
                                    href={"/new?showExamples=true"}
                                >
                                    Try a configured demo repository
                                </LinkButton>
                                <LinkButton href={"/new"} className="gap-1.5">
                                    Configure your own repository
                                </LinkButton>
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
