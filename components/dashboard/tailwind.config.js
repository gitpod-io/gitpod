/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// tailwind.config.js
const colors = require('tailwindcss/colors');

module.exports = {
    jit: true,
    purge: [
        './public/**/*.html',
        './src/**/*.{js,ts,tsx}',
    ],
    important: true,
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                gray: colors.warmGray,
                green: colors.lime,
                orange: colors.amber,
                blue: {
                    light: '#75A9EC',
                    DEFAULT: '#5C8DD6',
                    dark: '#265583',
                },
                'gitpod-black': '#161616',
                'gitpod-gray': '#8E8787',
                'gitpod-red': '#CE4A3E',
                'gitpod-kumquat-light': '#FFE4BC',
                'gitpod-kumquat': '#FFB45B',
                'gitpod-kumquat-dark': '#FF8A00',
                'gitpod-kumquat-darker': '#f28300',
                'gitpod-kumquat-gradient': 'linear-gradient(137.41deg, #FFAD33 14.37%, #FF8A00 91.32%)',
            },
            container: {
                center: true,
            },
            outline: {
                blue: '1px solid #000033',
            },
        },
        fontFamily: {
            sans: [
                'Inter',
                'system-ui',
                '-apple-system',
                'BlinkMacSystemFont',
                'Segoe UI',
                'Roboto',
                'Helvetica Neue',
                'Arial',
                'Noto Sans',
                'sans-serif',
                'Apple Color Emoji',
                'Segoe UI Emoji',
                'Segoe UI Symbol',
                'Noto Color Emoji',
            ],
            mono: [
                'SF Mono',
                'Monaco',
                'Inconsolata',
                'Fira Mono',
                'Droid Sans Mono',
                'Source Code Pro',
                'monospace'
            ],
        },
        underlineThickness: {
            'thin': '2px',
            'thick': '5px'
        },
        underlineOffset: {
            'small': '2px',
            'medium': '5px',
        },
        filter: { // defaults to {}
            // https://github.com/benface/tailwindcss-filters#usage
            'none': 'none',
            'grayscale': 'grayscale(1)',
            'invert': 'invert(1)',
            'brightness-10': 'brightness(10)',
        },
    },
    variants: {
        extend: {
            opacity: ['disabled'],
            display: ['dark'],
        }
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('tailwind-underline-utils'),
        require('tailwindcss-filters'),
        // ...
    ],
};