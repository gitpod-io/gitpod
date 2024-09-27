// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/common"
)

var (
	ErrTokenNotFound = fmt.Errorf("no owner cookie present")
	ErrTokenMismatch = fmt.Errorf("owner token mismatch")
	ErrTokenDecode   = fmt.Errorf("cannot decode owner token")
)

// WorkspaceAuthHandler rejects requests which are not authenticated or authorized to access a workspace.
func WorkspaceAuthHandler(domain string, info common.WorkspaceInfoProvider) mux.MiddlewareFunc {
	return func(h http.Handler) http.Handler {
		cookiePrefix := domain
		for _, c := range []string{" ", "-", "."} {
			cookiePrefix = strings.ReplaceAll(cookiePrefix, c, "_")
		}
		cookiePrefix = "_" + cookiePrefix + "_ws_"

		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			var (
				log  = getLog(req.Context())
				vars = mux.Vars(req)
				wsID = vars[common.WorkspaceIDIdentifier]
				port = vars[common.WorkspacePortIdentifier]
			)
			if wsID == "" {
				log.Warn("workspace request without workspace ID")
				resp.WriteHeader(http.StatusForbidden)

				return
			}

			ws := info.WorkspaceInfo(wsID)
			if ws == nil {
				resp.WriteHeader(http.StatusNotFound)

				return
			}

			isPublic := false
			if ws.Auth != nil && ws.Auth.Admission == api.AdmissionLevel_ADMIT_EVERYONE {
				isPublic = true
			} else if port != "" {
				prt, err := strconv.ParseUint(port, 10, 16)
				if err != nil {
					log.WithField("port", port).WithError(err).Error("cannot convert port to int")
				} else {
					for _, p := range ws.Ports {
						if p.Port == uint32(prt) {
							isPublic = p.Visibility == api.PortVisibility_PORT_VISIBILITY_PUBLIC
							break
						}
					}
				}
			}

			authenticate := func() (bool, error) {
				tkn := req.Header.Get("x-gitpod-owner-token")
				if tkn == "" {
					cn := fmt.Sprintf("%s%s_owner_", cookiePrefix, ws.InstanceID)
					c, err := req.Cookie(cn)
					if err != nil {
						return false, ErrTokenNotFound
					}
					tkn = c.Value
				}
				tkn, err := url.QueryUnescape(tkn)
				if err != nil {
					return false, ErrTokenDecode
				}

				if tkn != ws.Auth.OwnerToken {
					return false, ErrTokenMismatch
				}
				return true, nil
			}

			authenticated, err := authenticate()
			if !authenticated && !isPublic {
				if err != nil {
					if errors.Is(err, ErrTokenNotFound) {
						resp.WriteHeader(http.StatusUnauthorized)
						return
					}
					if errors.Is(err, ErrTokenMismatch) {
						log.Warn("owner token mismatch")
						resp.WriteHeader(http.StatusForbidden)
						return
					}
					if errors.Is(err, ErrTokenDecode) {
						log.Warn("cannot decode owner token")
						resp.WriteHeader(http.StatusBadRequest)
						return
					}
				}
				log.WithError(err).Error("cannot authenticate")
				resp.WriteHeader(http.StatusInternalServerError)
				return
			}

			if !authenticated && isPublic {
				ctx, id, err := info.AcquireContext(req.Context(), wsID, port)
				if err != nil {
					log.WithError(err).Error("cannot acquire context")
					resp.WriteHeader(http.StatusInternalServerError)
					return
				}
				defer info.ReleaseContext(id)
				req = req.WithContext(ctx)
			}

			h.ServeHTTP(resp, req)
		})
	}
}
