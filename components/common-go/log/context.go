// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package log

import (
	"context"

	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"github.com/sirupsen/logrus"
)

func Extract(ctx context.Context) *logrus.Entry {
	return ctxlogrus.Extract(ctx)
}

func AddFields(ctx context.Context, fields logrus.Fields) {
	ctxlogrus.AddFields(ctx, fields)
}

func ToContext(ctx context.Context, entry *logrus.Entry) context.Context {
	return ctxlogrus.ToContext(ctx, entry)
}
