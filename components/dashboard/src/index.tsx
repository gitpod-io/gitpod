import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { AppProvider } from './contexts';
import { service } from './service/service';

import "./tailwind.output.css"

service.getOrLoadUser().then(user => console.log(user.name));

ReactDOM.render(
    <React.StrictMode>
        <AppProvider>
            <App />
        </AppProvider>
    </React.StrictMode>,
    document.getElementById('root')
);