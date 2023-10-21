/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// tailwind.config.js
const colors = require("tailwindcss/colors");

module.exports = {
    jit: true,
    content: ["./public/**/*.html", "./src/**/*.{js,ts,tsx}"],
    important: true,
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                green: colors.lime,
                orange: colors.amber,
                // TODO: figure out if we want to just pull in the specific gitpod-* colors
                teal: colors.teal,
                sky: colors.sky,
                rose: colors.rose,
                "gitpod-black": "#161616",
                "gitpod-red": "#CE4A3E",
                "kumquat-dark": "#FF8A00",
                "kumquat-base": "#FFAE33",
                "kumquat-ripe": "#FFB45B",
                "kumquat-light": "#FFE4BC",
                "kumquat-gradient": "linear-gradient(137.41deg, #FFAD33 14.37%, #FF8A00 91.32%)",
                "gray-900": "#12100C",
                "gray-800": "#23211E",
                "gray-700": "#514F4D",
                "gray-600": "#565451",
                "gray-500": "#666564",
                "gray-400": "#999795",
                "gray-300": "#DADADA",
                "gray-200": "#ECE7E5",
                "gray-100": "#F5F4F4",
                "gray-50": "#F9F9F9",
            },
            container: {
                center: true,
            },
            outline: {
                blue: "1px solid #000033",
            },
            width: {
                112: "28rem",
                128: "32rem",
            },
            lineHeight: {
                64: "64px",
            },
            keyframes: {
                "toast-in-right": {
                    from: { transform: "translateX(100%)" },
                    to: { transform: "translateX(0)" },
                },
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
            },
            animation: {
                "toast-in-right": "toast-in-right 0.3s ease-in-out",
                "fade-in": "fade-in 3s linear",
                "fade-in-fast": "fade-in .3s ease-in-out",
                "spin-slow": "spin 2s linear infinite",
            },
            transitionProperty: {
                width: "width",
            },
        },
        fontFamily: {
            sans: [
                "Inter",
                "system-ui",
                "-apple-system",
                "BlinkMacSystemFont",
                "Segoe UI",
                "Roboto",
                "Helvetica Neue",
                "Arial",
                "Noto Sans",
                "sans-serif",
                "Apple Color Emoji",
                "Segoe UI Emoji",
                "Segoe UI Symbol",
                "Noto Color Emoji",
            ],
            mono: [
                "JetBrains Mono",
                "SF Mono",
                "Monaco",
                "Inconsolata",
                "Fira Mono",
                "Droid Sans Mono",
                "Source Code Pro",
                "monospace",
            ],
        },
        underlineThickness: {
            thin: "2px",
            thick: "5px",
        },
        underlineOffset: {
            small: "2px",
            medium: "5px",
        },
        filter: {
            // defaults to {}
            // https://github.com/benface/tailwindcss-filters#usage
            none: "none",
            grayscale: "grayscale(1)",
            invert: "invert(1)",
            "brightness-10": "brightness(10)",
        },
    },
    variants: {
        extend: {
            opacity: ["disabled"],
            display: ["dark"],
        },
    },
    plugins: [
        require("@tailwindcss/forms"),
        require("tailwind-underline-utils"),
        require("tailwindcss-filters"),
        require("tailwindcss-animate"),
        // ...
    ],
};
