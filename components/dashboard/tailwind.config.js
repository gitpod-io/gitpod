/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// tailwind.config.js
const colors = require('tailwindcss/colors');

module.exports = {
    important: true,
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
            'brightness-10': 'brightness(10)',
        },
    },
    variants: {
        extend: {
            opacity: ['disabled'],
        }
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('tailwind-underline-utils'),
        require('tailwindcss-filters'),
        // ...
    ],
};