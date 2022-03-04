// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bufio"
	"bytes"
	"fmt"
	"html/template"
	"strings"
	"unicode"
)

var licenseTemplate = make(map[string]*template.Template)

func init() {
	// licenseTemplate["apache"] = template.Must(template.New("").Parse(tmplApache))
	licenseTemplate["mit"] = template.Must(template.New("").Parse(tmplMIT))
	// licenseTemplate["bsd"] = template.Must(template.New("").Parse(tmplBSD))
	// licenseTemplate["mpl"] = template.Must(template.New("").Parse(tmplMPL))
	licenseTemplate["agpl"] = template.Must(template.New("").Parse(tmplAGPL))
	licenseTemplate["gpshf"] = template.Must(template.New("").Parse(tmplGPSHF))
}

type copyrightData struct {
	Year   string
	Holder string
}

// prefix will execute a license template t with data d
// and prefix the result with top, middle and bottom.
func prefix(t *template.Template, d *copyrightData, top, mid, bot string) ([]byte, error) {
	var buf bytes.Buffer
	if err := t.Execute(&buf, d); err != nil {
		return nil, err
	}
	var out bytes.Buffer
	if top != "" {
		fmt.Fprintln(&out, top)
	}
	s := bufio.NewScanner(&buf)
	for s.Scan() {
		fmt.Fprintln(&out, strings.TrimRightFunc(mid+s.Text(), unicode.IsSpace))
	}
	if bot != "" {
		fmt.Fprintln(&out, bot)
	}
	fmt.Fprintln(&out)
	return out.Bytes(), nil
}

/*
const tmplApache = `Copyright {{.Year}} {{.Holder}}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`

const tmplBSD = `Copyright (c) {{.Year}} {{.Holder}} All rights reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file.`

const tmplMPL = `This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.`
*/

const tmplMIT = `Copyright (c) {{.Year}} {{.Holder}}. All rights reserved.
Licensed under the MIT License. See License-MIT.txt in the project root for license information.`

const tmplAGPL = `Copyright (c) {{.Year}} {{.Holder}}. All rights reserved.
Licensed under the GNU Affero General Public License (AGPL).
See License-AGPL.txt in the project root for license information.`

const tmplGPSHF = `Copyright (c) {{.Year}} {{.Holder}}. All rights reserved.
Licensed under the Gitpod Enterprise Source Code License,
See License.enterprise.txt in the project root folder.`
