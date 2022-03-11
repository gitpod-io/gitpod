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
