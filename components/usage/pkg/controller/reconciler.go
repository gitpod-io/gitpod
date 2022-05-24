// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import "github.com/gitpod-io/gitpod/common-go/log"

type Reconciler interface {
	Reconcile() error
}

type ReconcilerFunc func() error

func (f ReconcilerFunc) Reconcile() error {
	return f()
}

func HelloWorldReconciler() error {
	log.Info("Hello world reconciler!")
	return nil
}
