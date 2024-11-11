/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect, useState } from "react";
import blogBannerBg from "../images/blog-banner-bg.png";

const banners = [
    {
        type: "Watch recording",
        title: "Beyond Kubernetes: A deep-dive into Gitpod Flex with our CTO",
        link: "https://www.gitpod.io/events#watch-on-demand",
    },
    {
        type: "Blog Post",
        title: "Gitpod Enterprise:<br/> Self-hosted, not self-managed",
        link: "https://www.gitpod.io/blog/self-hosted-not-self-managed",
    },
    {
        type: "Customer Story",
        title: "Thousands of hours spent on VM-based development environments reduced to zero using Gitpod",
        link: "https://www.gitpod.io/customers/kingland",
    },
    {
        type: "Gartner Report",
        title: `"By 2026, 60% of cloud workloads will be built and deployed using CDE's"`,
        link: "https://www.gitpod.io/blog/gartner-2023-cde-hypecycle",
    },
];

const initialBannerIndex = 0; // Index for "Self-hosted, not self-managed"

export const BlogBanners: React.FC = () => {
    const [currentBannerIndex, setCurrentBannerIndex] = useState(initialBannerIndex);

    useEffect(() => {
        const storedBannerData = localStorage.getItem("blog-banner-data");
        const currentTime = new Date().getTime();

        if (storedBannerData) {
            const { lastIndex, lastTime } = JSON.parse(storedBannerData);

            if (currentTime - lastTime >= 2 * 24 * 60 * 60 * 1000) {
                // 2 days in milliseconds
                const nextIndex = getRandomBannerIndex(lastIndex);
                setCurrentBannerIndex(nextIndex);
                localStorage.setItem(
                    "blog-banner-data",
                    JSON.stringify({ lastIndex: nextIndex, lastTime: currentTime }),
                );
            } else {
                setCurrentBannerIndex(lastIndex);
            }
        } else {
            setCurrentBannerIndex(initialBannerIndex);
            localStorage.setItem(
                "blog-banner-data",
                JSON.stringify({ lastIndex: initialBannerIndex, lastTime: currentTime }),
            );
        }
    }, []);

    const getRandomBannerIndex = (excludeIndex: number) => {
        let nextIndex;
        do {
            nextIndex = Math.floor(Math.random() * banners.length);
        } while (nextIndex === excludeIndex || nextIndex === initialBannerIndex);
        return nextIndex;
    };

    return (
        <div className="flex flex-col">
            <a
                href={banners[currentBannerIndex].link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-pk-surface rounded-lg overflow-hidden flex flex-col gap-2 text-decoration-none text-inherit max-w-[320px] border border-gray-200 dark:border-gray-800 hover:shadow"
                aria-label={banners[currentBannerIndex].type + " - " + banners[currentBannerIndex].title}
                style={{
                    backgroundPosition: "top left",
                    backgroundRepeat: "no-repeat",
                    backgroundImage: `url(${blogBannerBg})`,
                    backgroundSize: "contain",
                }}
            >
                <div className="flex flex-col gap-8 mt-6 ml-4 max-w-[320px] overflow-wrap min-h-fit pb-4">
                    <div className="bg-pk-surface-invert w-fit text-pk-content-invert-primary text-sm leading-[18px] font-bold rounded-2xl py-1 px-4">
                        {banners[currentBannerIndex].type}
                    </div>
                    <div
                        className="text-base font-semibold text-pk-content-primary max-w-[285px]"
                        dangerouslySetInnerHTML={{ __html: banners[currentBannerIndex].title }}
                    />
                </div>
            </a>
        </div>
    );
};
