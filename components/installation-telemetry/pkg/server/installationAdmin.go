// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/gitpod-io/gitpod/installation-telemetry/pkg/common"
)

type InstallationAdminSettings struct {
	SendTelemetry bool `json:"sendTelemetry"`
}

type InstallationAdminData struct {
	ID       string                    `json:"id"`
	Settings InstallationAdminSettings `json:"settings"`
}

func GetInstallationAdminData(config common.Config) (*InstallationAdminData, error) {
	resp, err := http.Get(fmt.Sprintf("%s/data", config.Server))
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data InstallationAdminData
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}

	return &data, nil
}
