/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MuxPlayerProps } from "@mux/mux-player-react";
import { cn } from "@podkit/lib/cn";
import { SkeletonBlock } from "@podkit/loading/Skeleton";
import { lazy, Suspense, FC } from "react";

const MuxPlayer = lazy(() => import("@mux/mux-player-react"));

type Props = {
    playbackId: string;
    metadataVideoTitle: string;
    poster?: string;
    className?: string;
    playerProps?: MuxPlayerProps;
};
export const VideoSection: FC<Props> = ({ playbackId, metadataVideoTitle, poster, className, playerProps }) => (
    <div
        className={cn(
            "flex w-full flex-col items-start justify-start overflow-hidden rounded-md drop-shadow-xl",
            className,
        )}
    >
        <Suspense fallback={<SkeletonBlock ready={false} className="max-h-[300px] w-full" />}>
            <MuxPlayer
                aria-label={"Video: " + metadataVideoTitle}
                streamType="on-demand"
                playbackId={playbackId}
                metadataVideoTitle={metadataVideoTitle}
                primaryColor="#FFFFFF"
                secondaryColor="#000000"
                accentColor="#FF8A00"
                defaultHiddenCaptions={playerProps?.defaultHiddenCaptions ?? true}
                poster={poster}
                style={{
                    aspectRatio: "16 / 9",
                    backgroundColor: "var(--surface-tertiary)",
                    borderRadius: "6px",
                }}
                preload={"metadata"}
                disableCookies
                disableTracking
                {...playerProps}
            />
        </Suspense>
    </div>
);
