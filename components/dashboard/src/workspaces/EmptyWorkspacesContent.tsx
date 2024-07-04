/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect } from "react";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { trackVideoClick } from "../Analytics";

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

export const EmptyWorkspacesContent = () => {
    useEffect(() => {
        // Load the YouTube IFrame Player API code asynchronously
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        // Create YouTube player when API is ready
        window.onYouTubeIframeAPIReady = () => {
            new window.YT.Player("gitpod-video", {
                events: {
                    onStateChange: onPlayerStateChange,
                },
            });
        };
    }, []);

    const onPlayerStateChange = (event: any) => {
        if (event.data === window.YT.PlayerState.PLAYING) {
            trackVideoClick("create-new-workspace");
        }
    };

    return (
        <div className="app-container flex flex-col space-y-2">
            <div className="px-6 mt-16 flex flex-row items-center justify-center space-x-14">
                <div>
                    <iframe
                        id="gitpod-video"
                        width="535"
                        height="307"
                        src="https://www.youtube.com/embed/1ZBN-b2cIB8?enablejsapi=1&modestbranding=1&rel=0&controls=1&showinfo=0&fs=1"
                        title="YouTube - Gitpod in 120 seconds"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="rounded-xl"
                    ></iframe>
                </div>
                <div>
                    <div className="flex flex-col items-left justify-center h-96 w-96">
                        <Heading2 className="text-left mb-4 !font-semibold !text-lg">
                            Create your first workspace
                        </Heading2>
                        <Subheading className="text-left max-w-xs">
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
                </div>
            </div>
        </div>
    );
};
