// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package frontend_dev

import (
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

const index_html = `<!doctype html>
<html lang="en">

<head>
<meta charset="utf-8" />
<link rel="icon" href="/favicon256.png" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#000000" />
<meta name="robots" content="noindex">
<meta name="Gitpod" content="Always Ready-to-Code" />
<link rel="apple-touch-icon" href="/favicon192.png" />
<link rel="manifest" href="/manifest.json" />
<title>Dashboard</title>
<script defer="defer" src="/static/js/main.b009793d.js"></script>
<link href="/static/css/main.32e61b25.css" rel="stylesheet">
</head>

<body><noscript>You need to enable JavaScript to run this app.</noscript>
<div id="root"></div>
</body>

</html>`

func Test_MatchAndRewriteRootRequest(t *testing.T) {

	type Test struct {
		name         string
		response     *http.Response
		newBaseUrl   string
		expectedBody string
	}
	tests := []Test{
		{
			name: "should match and rewrite root request",
			response: &http.Response{
				StatusCode: 200,
				Header: http.Header{
					"Content-Type": []string{"text/html"},
				},
				Body: ioutil.NopCloser(strings.NewReader(index_html)),
			},
			newBaseUrl: "https://3000-gitpodio-gitpod-hk3453q4csi.ws-eu108.gitpod.io",
			expectedBody: `<!doctype html>
<html lang="en">

<head>
<meta charset="utf-8" />
<link rel="icon" href="https://3000-gitpodio-gitpod-hk3453q4csi.ws-eu108.gitpod.io/favicon256.png" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#000000" />
<meta name="robots" content="noindex">
<meta name="Gitpod" content="Always Ready-to-Code" />
<link rel="apple-touch-icon" href="https://3000-gitpodio-gitpod-hk3453q4csi.ws-eu108.gitpod.io/favicon192.png" />
<link rel="manifest" href="https://3000-gitpodio-gitpod-hk3453q4csi.ws-eu108.gitpod.io/manifest.json" />
<title>Dashboard</title>
<script defer="defer" src="https://3000-gitpodio-gitpod-hk3453q4csi.ws-eu108.gitpod.io/static/js/main.js"></script>

</head>

<body><noscript>You need to enable JavaScript to run this app.</noscript>
<div id="root"></div>
</body>

</html>`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			newBase, err := url.Parse(test.newBaseUrl)
			if err != nil {
				t.Errorf("error parsing new base url: %v", err)
			}
			actual := MatchAndRewriteRootRequest(test.response, newBase)
			actualBodyBytes, err := ioutil.ReadAll(actual.Body)
			if err != nil {
				t.Errorf("error reading response body: %v", err)
			}
			actualBody := string(actualBodyBytes)
			if strings.Compare(actualBody, test.expectedBody) != 0 {
				t.Errorf("got %v, want %v", actualBody, test.expectedBody)
			}
		})
	}
}
