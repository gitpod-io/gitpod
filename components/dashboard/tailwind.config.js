// tailwind.config.js
module.exports = {
    important: true,
    theme: {
        extend: {
            container: {
                center: true,
            },
            outline: {
                blue: '1px solid #000033',
            }
        },
        fontFamily: {
            'sans': ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
        }
    },
    plugins: [
        require('@tailwindcss/forms'),
        // ...
    ],
}