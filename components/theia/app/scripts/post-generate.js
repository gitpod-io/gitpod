/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check
const path = require('path');
const fs = require('fs');

const faviconPath = path.resolve(__dirname, '../favicon.ico')
const faviconNewPath = path.resolve(__dirname, '../lib/favicon.ico')
fs.copyFileSync(faviconPath, faviconNewPath);

const index_html = path.resolve(__dirname, '../lib/index.html');
const html  = fs.readFileSync(index_html, 'utf-8');

const new_html = html.replace('<head>', `
<head> <!-- ws marks generated -->
  <meta charset="utf-8">
  <meta name="referrer" content="origin">
  <link rel="shortcut icon" href="./favicon.ico">
  <style>
  #bootanimation {
    position: absolute;
  }
  .gitpod-boot-logo-div {
      width: 100%;
      height: 100%;
      position: absolute;
  }
  .gitpod-boot-logo-div .gitpod-boot-logo {
      display: block;
      position: relative;
      margin-left: auto;
      margin-right: auto;
      top: 35%;
      width: 150px;
      height: 150px;
  }
  .theia-preload {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;

    padding: 0;
    margin: 0;
    background-image: none !important;
    background: #1e1e1e;
  }

  #starter {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100vw;
    height: 100vh;
    border: 0px;
    overflow: hidden;
  }
  </style>
  <script>
    function showStart() {
        window.addEventListener("message", evt => {
            if (evt.isTrusted && evt.data.type == 'relocate' && evt.data.url) {
                window.location.href = evt.data.url;
            }
        }, false);

        let segs = window.location.host.split('.');
        let startURL = window.location.protocol + '//' + segs.splice(2, 4).join('.') + '/start/#' + segs[0];
        if (window.location.host.includes("localhost") || window.location.pathname.substring(0, 11) === "/workspace/") {
            // /workspace/ paths are used for all path-routed ingress modes, e.g. pathAndHost or noDomain
            segs = window.location.pathname.split('/');
            startURL = window.location.protocol + '//' + window.location.host + '/start/#' + segs[segs.length - 2];
        }

        var iframe = document.createElement('iframe');
        iframe.id = 'starter';
        iframe.src = startURL;
        document.querySelector('#startup-progress').appendChild(iframe);
    }
    window.addEventListener('DOMContentLoaded', (event) => {
        showStart();
    });
  </script>
`)
.replace('theia-preload">', `theia-preload" id="startup-progress">`)

fs.writeFileSync(index_html, new_html);
