// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// WorkspaceAuthHandler rejects requests which are not authenticated or authorized to access a workspace.
func WorkspaceAuthHandler(domain string, info WorkspaceInfoProvider) mux.MiddlewareFunc {
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
				wsID = vars[workspaceIDIdentifier]
				port = vars[workspacePortIdentifier]
			)
			if wsID == "" {
				log.Warn("workspace request without workspace ID")
				resp.WriteHeader(http.StatusForbidden)

				return
			}

			ws := info.WorkspaceInfo(wsID)
			if ws == nil {
				log.WithField("workspaceId", wsID).Warn("did not find workspace info")
				resp.WriteHeader(http.StatusNotFound)

				return
			}

			if ws.Auth != nil && ws.Auth.Admission == api.AdmissionLevel_ADMIT_EVERYONE {
				// workspace is free for all - no tokens or cookies matter
				h.ServeHTTP(resp, req)

				return
			}

			if port != "" {
				// this is a workspace port request and ports can be public or private.
				// For public ports no tokens or cookies matter, private ports are subject
				// to the same access policies as the workspace itself is.
				var isPublic bool

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

				if isPublic {
					// workspace port is free for all - no tokens or cookies matter
					h.ServeHTTP(resp, req)

					return
				}

				// port seems to be private - subject it to the same access policy as the workspace itself
			}

			tkn := req.Header.Get("x-gitpod-owner-token")
			if tkn == "" {
				cn := fmt.Sprintf("%s%s_owner_", cookiePrefix, ws.InstanceID)
				c, err := req.Cookie(cn)
				if err != nil {
					log.WithField("cookieName", cn).Debug("no owner cookie present")
					resp.WriteHeader(http.StatusUnauthorized)

					return
				}

				tkn = c.Value
			}
			tkn, err := url.QueryUnescape(tkn)
			if err != nil {
				log.WithError(err).Warn("cannot decode owner token")
				resp.WriteHeader(http.StatusBadRequest)

				return
			}

			if tkn != ws.Auth.OwnerToken {
				log.Warn("owner token mismatch")
				resp.WriteHeader(http.StatusForbidden)

				return
			}

			h.ServeHTTP(resp, req)
		})
	}
}
