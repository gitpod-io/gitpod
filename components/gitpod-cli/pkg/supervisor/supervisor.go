// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"os"

	log "github.com/sirupsen/logrus"
	"google.golang.org/grpc"
)

func Dial() *grpc.ClientConn {
	supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
	if supervisorAddr == "" {
		supervisorAddr = "localhost:22999"
	}
	supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithInsecure())
	if err != nil {
		log.WithError(err).Fatal("cannot connect to supervisor")
	}

	return supervisorConn
}
