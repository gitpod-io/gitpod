// tailwind.config.js
const colors = require('tailwindcss/colors');

module.exports = {
    important: true,
    theme: {
        extend: {
            colors: {
                gray: colors.warmGray,
                green: {
                  light: '#9DD714',
                  DEFAULT: '#58B19F',
                  dark: '#467A45',
                },
                red: {
                  light: '#EF9C9A',
                  DEFAULT: '#CE4A3E',
                  dark: '#B1336A',
                },
                blue: {
                  light: '#75A9EC',
                  DEFAULT: '#5C8DD6',
                  dark: '#265583',
                },
                'gitpod-black': '#161616',
                'gitpod-gray': '#8E8787',
                'gitpod-kumquat-light': '#FFCE4F',
                'gitpod-kumquat': '#FFB45B',
                'gitpod-kumquat-dark': '#FF8A00',
                'gitpod-kumquat-gradient': 'linear-gradient(137.41deg, #FFAD33 14.37%, #FF8A00 91.32%)',
            },
            container: {
                center: true,
            },
            outline: {
                blue: '1px solid #000033',
            }
        },
        fontFamily: {
            'sans': ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        // ...
    ],
};