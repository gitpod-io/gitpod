import React from 'react';
import ReactDOM from 'react-dom';
import "./tailwind.output.css"
import App from './App';
import { ServiceContext, SimpleServiceImpl } from './service/service';

const service = new SimpleServiceImpl();
service.service.server.getLoggedInUser().then(user => {
  service.user = user;
  ReactDOM.render(
    <React.StrictMode>
      <ServiceContext.Provider value={service}>
        <App />
      </ServiceContext.Provider>
    </React.StrictMode>,
    document.getElementById('root')
  );
});
