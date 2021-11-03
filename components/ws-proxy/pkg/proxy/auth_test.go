// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestWorkspaceAuthHandler(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.PanicLevel)
	type testResult struct {
		HandlerCalled bool
		StatusCode    int
	}

	const (
		domain      = "test-domain.com"
		workspaceID = "workspac-65f4-43c9-bf46-3541b89dca85"
		instanceID  = "instance-fce1-4ff6-9364-cf6dff0c4ecf"
		ownerToken  = "owner-token"
		testPort    = 8080
	)
	var (
		ownerOnlyInfos = map[string]*WorkspaceInfo{
			workspaceID: {
				WorkspaceID: workspaceID,
				InstanceID:  instanceID,
				Auth: &api.WorkspaceAuthentication{
					Admission:  api.AdmissionLevel_ADMIT_OWNER_ONLY,
					OwnerToken: ownerToken,
				},
				Ports: []*api.PortSpec{{Port: testPort, Visibility: api.PortVisibility_PORT_VISIBILITY_PRIVATE}},
			},
		}
		publicPortInfos = map[string]*WorkspaceInfo{
			workspaceID: {
				WorkspaceID: workspaceID,
				InstanceID:  instanceID,
				Auth: &api.WorkspaceAuthentication{
					Admission:  api.AdmissionLevel_ADMIT_OWNER_ONLY,
					OwnerToken: ownerToken,
				},
				Ports: []*api.PortSpec{{Port: testPort, Visibility: api.PortVisibility_PORT_VISIBILITY_PUBLIC}},
			},
		}
		admitEveryoneInfos = map[string]*WorkspaceInfo{
			workspaceID: {
				WorkspaceID: workspaceID,
				InstanceID:  instanceID,
				Auth:        &api.WorkspaceAuthentication{Admission: api.AdmissionLevel_ADMIT_EVERYONE},
			},
		}
	)
	tests := []struct {
		Name        string
		Infos       map[string]*WorkspaceInfo
		OwnerCookie string
		WorkspaceID string
		Port        string
		Expected    testResult
	}{
		{
			Name:        "workspace not found",
			WorkspaceID: workspaceID,
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusNotFound,
			},
		},
		{
			Name: "no workspace",
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusForbidden,
			},
		},
		{
			Name:        "no credentials",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusUnauthorized,
			},
		},
		{
			Name:        "wrong credentials",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: "this is the wrong value",
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusForbidden,
			},
		},
		{
			Name:        "broken credentials",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: "%^? is invalid encoding ",
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusBadRequest,
			},
		},
		{
			Name:        "correct credentials",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: ownerToken,
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "admit everyone without cookie",
			Infos:       admitEveryoneInfos,
			WorkspaceID: workspaceID,
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "admit everyone with cookie",
			Infos:       admitEveryoneInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: ownerToken,
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "admit everyone with wrong cookie",
			Infos:       admitEveryoneInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: ownerToken + "-this-is-wrong",
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "private port",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: ownerToken,
			Port:        strconv.Itoa(testPort),
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "private port without cookie",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			Port:        strconv.Itoa(testPort),
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusUnauthorized,
			},
		},
		{
			Name:        "private port with wrong cookie",
			Infos:       ownerOnlyInfos,
			WorkspaceID: workspaceID,
			OwnerCookie: ownerToken + "-this-is-wrong",
			Port:        strconv.Itoa(testPort),
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusForbidden,
			},
		},
		{
			Name:        "public port",
			Infos:       publicPortInfos,
			WorkspaceID: workspaceID,
			Port:        strconv.Itoa(testPort),
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "broken port",
			Infos:       publicPortInfos,
			WorkspaceID: workspaceID,
			Port:        "not a valid number",
			OwnerCookie: ownerToken,
			Expected: testResult{
				HandlerCalled: true,
				StatusCode:    http.StatusOK,
			},
		},
		{
			Name:        "broken port without cookie",
			Infos:       publicPortInfos,
			WorkspaceID: workspaceID,
			Port:        "not a valid number",
			Expected: testResult{
				HandlerCalled: false,
				StatusCode:    http.StatusUnauthorized,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var res testResult
			handler := WorkspaceAuthHandler(domain, &fixedInfoProvider{Infos: test.Infos})(http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
				res.HandlerCalled = true
				resp.WriteHeader(http.StatusOK)
			}))

			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("http://%s/", domain), nil)
			if test.OwnerCookie != "" {
				setOwnerTokenCookie(req, instanceID, test.OwnerCookie)
			}
			vars := map[string]string{
				workspaceIDIdentifier: test.WorkspaceID,
			}
			if test.Port != "" {
				vars[workspacePortIdentifier] = test.Port
			}
			req = mux.SetURLVars(req, vars)

			handler.ServeHTTP(rr, req)
			res.StatusCode = rr.Code

			if diff := cmp.Diff(test.Expected, res); diff != "" {
				t.Errorf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}

func setOwnerTokenCookie(r *http.Request, instanceID, token string) {
	r.AddCookie(&http.Cookie{Name: "_test_domain_com_ws_" + instanceID + "_owner_", Value: token})
}
