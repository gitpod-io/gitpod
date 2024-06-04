/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// tailwind.config.js
const colors = require("tailwindcss/colors");

// TODO: Can replace these w/ rgb(var(...)) references so colors are only defined in our main CSS file
const podkitColors = {
    black: "#161616",
    white: "#FFFFFF",
    gray: {
        900: "#12100C",
        850: "#151310",
        800: "#23211E",
        750: "#2C2B28",
        700: "#514F4D",
        600: "#565451",
        500: "#666564",
        450: "#999795",
        400: "#747372",
        300: "#DADADA",
        200: "#ECE7E5",
        100: "#F5F4F4",
        50: "#F9F9F9",
    },
};

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
                "gitpod-black": podkitColors.black,
                "gitpod-red": "#CE4A3E",
                "kumquat-dark": "#FF8A00",
                "kumquat-base": "#FFAE33",
                "kumquat-ripe": "#FFB45B",
                "kumquat-light": "#FFE4BC",
                gray: podkitColors.gray,
                // Podkit colors - eventually we'll only use these colors
                // Once migrated, we can remove the colors above and shift this up under theme directly instead of extend
                "pk-content": {
                    primary: "rgb(var(--content-primary) / <alpha-value>)",
                    secondary: "rgb(var(--content-secondary) / <alpha-value>)",
                    tertiary: "rgb(var(--content-tertiary) / <alpha-value>)",
                    disabled: "rgb(var(--content-disabled) / <alpha-value>)",
                    "invert-primary": "rgb(var(--content-invert-primary) / <alpha-value>)",
                    "invert-secondary": "rgb(var(--content-invert-secondary) / <alpha-value>)",
                    danger: "rgb(var(--content-danger) / <alpha-value>)",
                },
                "pk-surface": {
                    primary: "rgb(var(--surface-primary) / <alpha-value>)",
                    secondary: "rgb(var(--surface-secondary) / <alpha-value>)",
                    tertiary: "rgb(var(--surface-tertiary) / <alpha-value>)",
                    labels: "rgb(var(--surface-labels) / <alpha-value>)",
                    invert: "rgb(var(--surface-invert) / <alpha-value>)",
                },
                "pk-border": {
                    light: "rgb(var(--border-light) / <alpha-value>)",
                    base: "rgb(var(--border-base) / <alpha-value>)",
                    strong: "rgb(var(--border-strong) / <alpha-value>)",
                    invert: "rgb(var(--border-invert) / <alpha-value>)",
                },
            },
            backgroundImage: {
                "kumquat-gradient": "linear-gradient(137.41deg, #FFAD33 14.37%, #FF8A00 91.32%)",
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
            height: {
                112: "28rem",
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
