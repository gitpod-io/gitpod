// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/bufbuild/connect-go"
	"github.com/sirupsen/logrus"
)

func NewLogInterceptor(entry *logrus.Entry) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			ctx = log.ToContext(ctx, entry.WithContext(ctx))

			log.AddFields(ctx, logrus.Fields{
				"requestProtocol":   "connect",
				"requestProcedure":  req.Spec().Procedure,
				"address":           req.Peer().Addr,
				"requestStreamType": streamType(req.Spec().StreamType),
				"requestHeaders":    filterHeaders(req.Header()),
			})
			log.Extract(ctx).Debugf("Handling request for %s", req.Spec().Procedure)

			resp, err := next(ctx, req)

			code := codeOf(err)
			log.AddFields(ctx, logrus.Fields{"responseCode": code})

			if err != nil {
				log.AddFields(ctx, logrus.Fields{logrus.ErrorKey: err})
			}

			if req.Spec().IsClient {
				if err != nil {
					log.Extract(ctx).Errorf("Received response for %s with code %s", req.Spec().Procedure, code)
				} else {
					log.Extract(ctx).Infof("Received response for %s with code %s", req.Spec().Procedure, code)
				}
			} else {
				if err != nil {
					log.Extract(ctx).Warnf("Completed handling of request for %s with code %s", req.Spec().Procedure, code)
				} else {
					log.Extract(ctx).Debugf("Completed handling of request for %s with code %s", req.Spec().Procedure, code)
				}
			}

			return resp, err
		}
	}

	return interceptor
}

func filterHeaders(headers http.Header) http.Header {
	if headers == nil {
		return nil
	}

	cloned := headers.Clone()
	cloned.Del("Authorization")
	cloned.Del("Cookie")
	return cloned
}
