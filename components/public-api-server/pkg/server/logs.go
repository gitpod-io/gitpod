// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"

	"github.com/bufbuild/connect-go"
	"github.com/sirupsen/logrus"
)

func NewLogInterceptor(entry *logrus.Entry) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			logger := entry.
				WithContext(ctx).
				WithField("protocol", "connect").
				WithField("procedure", req.Spec().Procedure).
				WithField("address", req.Peer().Addr).
				WithField("stream_type", streamType(req.Spec().StreamType))

			isClient := req.Spec().IsClient

			if isClient {
				logger.WithField("headers", req.Header()).Debugf("Starting request for %s", req.Spec().Procedure)
			} else {
				logger.WithField("headers", req.Header()).Debugf("Handling request for %s", req.Spec().Procedure)
			}

			resp, err := next(ctx, req)
			code := codeOf(err)
			logger = logger.WithField("code", code)

			if err != nil {
				logger = logger.WithError(err)
				if isClient {
					logger.Errorf("Received response for %s with code %s", req.Spec().Procedure, code)
				} else {
					logger.Warnf("Completed handling of request for %s with code %s", req.Spec().Procedure, code)
				}
			} else {
				if resp.Any() != nil {
					logger = logger.WithField("response", resp.Any())
				}

				if isClient {
					logger.WithField("response", resp.Any()).Debugf("Received ok response for %s", req.Spec().Procedure)
				} else {
					logger.WithField("response", resp.Any()).Debugf("Completed handling of request for %s with code %s", req.Spec().Procedure, code)
				}
			}

			return resp, err
		})
	}

	return connect.UnaryInterceptorFunc(interceptor)
}
