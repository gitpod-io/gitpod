/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useState } from "react";
import { trackVideoClick } from "../Analytics";

import "lite-youtube-embed/src/lite-yt-embed.css";
import "lite-youtube-embed/src/lite-yt-embed";

interface Video {
    id: string;
    title: string;
    analyticsLabel: string;
}

const videos: Video[] = [
    { id: "1ZBN-b2cIB8", title: "Gitpod in 120 seconds", analyticsLabel: "gitpod-demo" },
    { id: "zhZNnzFlZnY", title: "Getting started with Gitpod", analyticsLabel: "getting-started-with-gitpod" },
    { id: "kuoHM2bpBqY", title: "Fully automate your dev setup", analyticsLabel: "automate-gitpod-setup" },
    { id: "_CwFzCbAsoU", title: "Personalise your workspace", analyticsLabel: "personalise-gitpod-workspace" },
];

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "lite-youtube": any;
        }
    }
}

export const VideoCarousel: React.FC = () => {
    const [currentVideo, setCurrentVideo] = useState(0);

    const handleDotClick = (index: number) => {
        setCurrentVideo(index);
    };

    const onPlayerStateChange = (index: number) => {
        trackVideoClick(videos[index].analyticsLabel);
    };

    return (
        <div className="video-carousel">
            <div className="video-container">
                {videos.map((video, index) => (
                    <div key={video.id} style={{ display: index === currentVideo ? "block" : "none" }}>
                        {index === currentVideo && (
                            <lite-youtube
                                videoid={video.id}
                                style={{
                                    width: "320px",
                                    height: "180px",
                                }}
                                class="rounded-lg"
                                playlabel={video.title}
                                onClick={() => onPlayerStateChange(index)}
                            ></lite-youtube>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex justify-center space-x-2 mt-2">
                {videos.map((_, index) => (
                    <button
                        key={index}
                        className={`w-3 h-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-kumquat-dark transition-colors duration-200 ease-in-out ${
                            index === currentVideo
                                ? "bg-kumquat-dark"
                                : "bg-gray-300 dark:bg-gray-600 hover:bg-kumquat-light dark:hover:bg-kumquat-light"
                        }`}
                        onClick={() => handleDotClick(index)}
                        aria-label={`Go to video ${index + 1}`}
                    ></button>
                ))}
            </div>
        </div>
    );
};
