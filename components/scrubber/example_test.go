// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"encoding/json"
	"testing"
)

func TestScrub(t *testing.T) {

	scrubber := Default

	// log.WithFieldSensitive("workspaceID", "gitpodio-gitpod-uesaddev73c").Info("hello world")
	scrubber.KeyValue("workspaceID", "gitpodio-gitpod-uesaddev73c") // -> [scrubbed:md5:ae3e415b124cdbac878e995cad169490]

	var someJSONData = json.RawMessage(`{"email": "foo@bar.com", "username": "foobar", "orgID": "112233", "desc": "the email is foo@bar.com"}`)
	scrubber.JSON(someJSONData) // -> `{"email": "[scrubbed:md5:e2e6d7a977f2ca2b3900e22c68655b30]", "username": "[scrubbed:md5:14758f1afd44c09b7992073ccf00b43d]", "orgID": "[scrubbed:md5:cc9d7e078ba46da002aba1cf665b0acf]", "desc": "the email is [scrubbed:email]"}`

	var user = User{
		Username:  "foobar",
		Email:     "foo@bar.com",
		AuthToken: "112233",
	}
	scrubber.Struct(&user) // -> {Username: "[scrubbed:md5:14758f1afd44c09b7992073ccf00b43d]", Email: "[scrubbed:md5:e2e6d7a977f2ca2b3900e22c68655b30]", AuthToken: "[scrubbed]"}

	scrubber.Value("this may be an email: foo@bar.com") // -> "this may be an email: [scrubbed:md5:e2e6d7a977f2ca2b3900e22c68655b30:email]"
}

type User struct {
	Username  string
	Email     string
	AuthToken string `scrub:"redact"`
}
