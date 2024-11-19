/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PropsWithClassName } from "@podkit/lib/cn";
import type { FC } from "react";

export const IconGitpodEngraved: FC<{ variant: "light" | "dark" } & PropsWithClassName> = ({ variant, className }) => {
    switch (variant) {
        case "light":
            return (
                <svg width="23" height="24" viewBox="0 0 23 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g filter="url(#filter0_i_1272_281)">
                        <path
                            fillRule="evenodd"
                            className={className}
                            clipRule="evenodd"
                            d="M13.561 1.19519C14.2114 2.33226 13.816 3.78076 12.6777 4.43051L5.60009 8.47059C5.41302 8.57738 5.29754 8.77626 5.29754 8.99167V15.3338C5.29754 15.5492 5.41302 15.748 5.6001 15.8548L11.2025 19.0529C11.3869 19.1581 11.6131 19.1581 11.7974 19.0529L17.3999 15.8548C17.587 15.748 17.7024 15.5492 17.7024 15.3338V11.3895L12.6665 14.2279C11.5247 14.8715 10.0768 14.4685 9.43259 13.328C8.78836 12.1874 9.19172 10.741 10.3335 10.0975L17.5393 6.0361C19.7343 4.79896 22.45 6.38319 22.45 8.90075V15.8153C22.45 17.4348 21.5813 18.9302 20.1736 19.7337L13.7415 23.4054C12.3525 24.1982 10.6474 24.1982 9.25852 23.4054L2.82635 19.7337C1.4187 18.9302 0.549988 17.4348 0.549988 15.8153V8.51012C0.549988 6.89058 1.4187 5.39521 2.82635 4.59169L10.3223 0.312837C11.4605 -0.336914 12.9106 0.0581311 13.561 1.19519Z"
                            fill="currentColor"
                            fillOpacity="0.1"
                        />
                    </g>
                    <defs>
                        <filter
                            id="filter0_i_1272_281"
                            x="0.549988"
                            y="0"
                            width="21.9"
                            height="25"
                            filterUnits="userSpaceOnUse"
                            colorInterpolationFilters="sRGB"
                        >
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                            <feColorMatrix
                                in="SourceAlpha"
                                type="matrix"
                                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                result="hardAlpha"
                            />
                            <feOffset dy="1" />
                            <feGaussianBlur stdDeviation="0.5" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
                            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_1272_281" />
                        </filter>
                    </defs>
                </svg>
            );
        case "dark":
            return (
                <svg width="23" height="24" viewBox="0 0 23 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g filter="url(#filter0_i_1272_127)">
                        <path
                            fillRule="evenodd"
                            className={className}
                            clipRule="evenodd"
                            d="M13.561 1.1952C14.2115 2.33226 13.816 3.78076 12.6777 4.43051L5.60011 8.47059C5.41303 8.57738 5.29756 8.77626 5.29756 8.99167V15.3338C5.29756 15.5492 5.41303 15.748 5.60011 15.8548L11.2026 19.0529C11.3869 19.1581 11.6131 19.1581 11.7974 19.0529L17.3999 15.8548C17.587 15.748 17.7025 15.5492 17.7025 15.3338V11.3895L12.6665 14.2279C11.5247 14.8715 10.0768 14.4685 9.4326 13.328C8.78838 12.1874 9.19173 10.741 10.3335 10.0975L17.5393 6.0361C19.7343 4.79896 22.45 6.38319 22.45 8.90075V15.8153C22.45 17.4348 21.5813 18.9302 20.1736 19.7337L13.7415 23.4054C12.3525 24.1982 10.6475 24.1982 9.25853 23.4054L2.82636 19.7337C1.41872 18.9302 0.550003 17.4348 0.550003 15.8153V8.51012C0.550003 6.89058 1.41872 5.39521 2.82636 4.59169L10.3223 0.312837C11.4605 -0.336914 12.9106 0.0581311 13.561 1.1952Z"
                            fill="currentColor"
                            fillOpacity="0.2"
                        />
                    </g>
                    <defs>
                        <filter
                            id="filter0_i_1272_127"
                            x="0.550003"
                            y="0"
                            width="21.9"
                            height="25"
                            filterUnits="userSpaceOnUse"
                            colorInterpolationFilters="sRGB"
                        >
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                            <feColorMatrix
                                in="SourceAlpha"
                                type="matrix"
                                values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                result="hardAlpha"
                            />
                            <feOffset dy="1" />
                            <feGaussianBlur stdDeviation="0.5" />
                            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
                            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_1272_127" />
                        </filter>
                    </defs>
                </svg>
            );
    }
};
