// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package theialib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"
)

// HTTPTheiaService provides access to Theia's CLI service
type HTTPTheiaService struct {
	URL   string
	Token string
}

var _ TheiaCLIService = &HTTPTheiaService{}

// NewServiceFromEnv produces a new Theia service client configured from environment variables
func NewServiceFromEnv() (*HTTPTheiaService, error) {
	theiaPort := os.Getenv("GITPOD_THEIA_PORT")
	if theiaPort == "" {
		theiaPort = "23000"
	}
	url := fmt.Sprintf("http://localhost:%s/gitpod/cli", theiaPort)

	apiToken := os.Getenv("GITPOD_CLI_APITOKEN")
	if apiToken == "" {
		return nil, fmt.Errorf("No GITPOD_CLI_APITOKEN environment variable set")
	}

	return &HTTPTheiaService{
		URL:   url,
		Token: apiToken,
	}, nil
}

type request struct {
	Method string      `json:"method"`
	Params interface{} `json:"params"`
}

func (service *HTTPTheiaService) sendRequest(req request) ([]byte, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, errors.Wrap(err, "cannot marshal request body")
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	httpreq, err := http.NewRequest("POST", service.URL, bytes.NewBuffer(body))
	if err != nil {
		return nil, errors.Wrap(err, "cannot create new request")
	}
	httpreq.Header.Set("Content-Type", "application/json")
	httpreq.Header["X-AuthToken"] = []string{service.Token}
	resp, err := client.Do(httpreq)
	if err != nil {
		return nil, errors.Wrap(err, "error while issuing request")
	}

	if resp.StatusCode == 403 {
		return nil, fmt.Errorf("not authenticated")
	} else if resp.StatusCode != 200 {
		return nil, fmt.Errorf("invalid request: %v", resp.StatusCode)
	}

	res, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// GetGitToken obtains a user's Git token for a particular action
func (service *HTTPTheiaService) GetGitToken(params GetGitTokenRequest) (*GetGitTokenResponse, error) {
	req := request{Method: "getGitToken", Params: params}
	rawResult, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	var res GetGitTokenResponse
	err = json.Unmarshal(rawResult, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// OpenPreview opens a file using Theia's preview capability
func (service *HTTPTheiaService) OpenPreview(params OpenPreviewRequest) (*OpenPreviewResponse, error) {
	req := request{Method: "openPreview", Params: params}
	_, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	return &OpenPreviewResponse{}, nil
}

// OpenFile opens a file in an editor
func (service *HTTPTheiaService) OpenFile(params OpenFileRequest) (*OpenFileResponse, error) {
	absPath, err := filepath.Abs(params.Path)
	if err != nil {
		return nil, err
	}

	if stat, err := os.Stat(absPath); os.IsNotExist(err) {
		if err := ioutil.WriteFile(absPath, []byte{}, 0644); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else if stat.IsDir() {
		return nil, fmt.Errorf("%s is a directory - can only open files", absPath)
	}
	params.Path = absPath

	req := request{Method: "openFile", Params: params}
	_, err = service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	return &OpenFileResponse{}, nil
}

// IsFileOpen returns true if a file is open
func (service *HTTPTheiaService) IsFileOpen(params IsFileOpenRequest) (*IsFileOpenResponse, error) {
	absPath, err := filepath.Abs(params.Path)
	if err != nil {
		return nil, err
	}
	params.Path = absPath

	req := request{Method: "isFileOpen", Params: params}
	rawResult, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	var res IsFileOpenResponse
	err = json.Unmarshal(rawResult, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// SetEnvVar sets a gitpod environment variable
func (service *HTTPTheiaService) SetEnvVar(params SetEnvvarRequest) (*SetEnvvarResponse, error) {
	req := request{Method: "setEnvVar", Params: params}
	_, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	return &SetEnvvarResponse{}, nil
}

// GetEnvVars returns the list of Gitpod env vars for this workspace
func (service *HTTPTheiaService) GetEnvVars(GetEnvvarsRequest) (*GetEnvvarsResponse, error) {
	req := request{Method: "getEnvVars", Params: GetEnvvarsRequest{}}
	rawResult, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	var res GetEnvvarsResponse
	err = json.Unmarshal(rawResult, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// DeleteEnvVar deletes environment variables
func (service *HTTPTheiaService) DeleteEnvVar(params DeleteEnvvarRequest) (*DeleteEnvvarResponse, error) {
	req := request{Method: "deleteEnvVar", Params: params}
	rawResult, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	var res DeleteEnvvarResponse
	err = json.Unmarshal(rawResult, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// GetPortURL returns the public, outward-facing URL of a port
func (service *HTTPTheiaService) GetPortURL(params GetPortURLRequest) (*GetPortURLResponse, error) {
	req := request{Method: "getPortURL", Params: params}
	rawResult, err := service.sendRequest(req)
	if err != nil {
		return nil, err
	}

	var res GetPortURLResponse
	err = json.Unmarshal(rawResult, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}
