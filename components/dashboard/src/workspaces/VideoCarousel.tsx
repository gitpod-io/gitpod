/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useState, useEffect, useRef } from "react";
import { trackVideoClick } from "../Analytics";

interface Video {
    id: string;
    title: string;
    analyticsLabel: string;
}

const videos: Video[] = [
    { id: "1ZBN-b2cIB8", title: "Video 1 Title", analyticsLabel: "intro-to-gitpod" },
    { id: "ij1msCffQZA", title: "Video 2 Title", analyticsLabel: "gitpod-features" },
    { id: "1ZBN-b2cIf8", title: "Video 3 Title", analyticsLabel: "gitpod-workflow" },
    { id: "ij1msCffQCA", title: "Video 4 Title", analyticsLabel: "gitpod-integrations" },
];

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

export const VideoCarousel: React.FC = () => {
    const [currentVideo, setCurrentVideo] = useState(0);
    const playerRefs = useRef<any[]>([]);

    useEffect(() => {
        // Load the YouTube IFrame Player API code asynchronously
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        // Create YouTube players when API is ready
        window.onYouTubeIframeAPIReady = () => {
            videos.forEach((video, index) => {
                playerRefs.current[index] = new window.YT.Player(`gitpod-video-${index}`, {
                    videoId: video.id,
                    events: {
                        onReady: (event: any) => {
                            // Player is ready
                            if (index !== currentVideo) {
                                event.target.stopVideo();
                            }
                        },
                        onStateChange: (event: any) => onPlayerStateChange(event, index),
                    },
                });
            });
        };
    }, [currentVideo]);

    const onPlayerStateChange = (event: any, videoIndex: number) => {
        if (event.data === window.YT.PlayerState.PLAYING) {
            trackVideoClick(videos[videoIndex].analyticsLabel);
        }
    };

    const handleDotClick = (index: number) => {
        const currentPlayer = playerRefs.current[currentVideo];

        if (currentPlayer && currentPlayer.pauseVideo) {
            currentPlayer.pauseVideo();
        }

        setCurrentVideo(index);
    };

    return (
        <div className="video-carousel">
            <div className="video-container">
                {videos.map((video, index) => (
                    <div key={video.id} style={{ display: index === currentVideo ? "block" : "none" }}>
                        <iframe
                            id={`gitpod-video-${index}`}
                            aspect-ratio="16 / 9"
                            height="180px"
                            width="320px"
                            src={`https://www.youtube.com/embed/${video.id}?enablejsapi=1&modestbranding=1&rel=0&controls=1&showinfo=0&fs=1&color=white&disablekb=1&iv_load_policy=3`}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="rounded-lg"
                        ></iframe>
                    </div>
                ))}
            </div>
            <div className="flex justify-center space-x-2 mt-4">
                {videos.map((_, index) => (
                    <button
                        key={index}
                        className={`w-3 h-3 rounded-full focus:outline-none transition-colors duration-200 ease-in-out ${
                            index === currentVideo
                                ? "bg-kumquat-dark"
                                : "bg-gray-300 dark:bg-gray-600 hover:bg-kumquat-light dark:hover:bg-kumquat-light"
                        }`}
                        onClick={() => {
                            handleDotClick(index);
                        }}
                        aria-label={`Go to video ${index + 1}`}
                    ></button>
                ))}
            </div>
        </div>
    );
};
