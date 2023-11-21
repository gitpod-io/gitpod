// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	docker "github.com/docker/docker/client"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/ws-cluster-manager/api/v1"
	"github.com/gitpod-io/gitpod/components/ws-cluster-manager/api/v1/v1connect"
	"github.com/spf13/pflag"
)

func main() {
	hostname, err := os.Hostname()
	if err != nil {
		panic(err)
	}
	var (
		name         = pflag.String("name", hostname, "name to register as")
		host         = pflag.String("host", "http://localhost:8081", "host to connect to")
		dockerSocket = pflag.String("docker-socket", "unix:///var/run/docker.sock", "docker socket to connect to")
		header       = pflag.StringToString("header", nil, "headers to send")
	)
	pflag.Parse()

	addHeaderUnary := connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			for k, v := range *header {
				req.Header().Set(k, v)
			}
			return next(ctx, req)
		}
	})

	client := v1connect.NewClusterServiceClient(http.DefaultClient, *host, connect.WithInterceptors(addHeaderUnary))
	_, err = client.Hello(context.Background(), &connect.Request[v1.HelloRequest]{
		Msg: &v1.HelloRequest{Name: *name},
	})
	if err != nil {
		log.WithError(err).Fatal("cannot connect to cluster manager")
	}

	dckr, err := docker.NewClientWithOpts(docker.WithHost(*dockerSocket), docker.WithAPIVersionNegotiation(), docker.FromEnv)
	if err != nil {
		log.WithError(err).Fatal("cannot connect to docker")
	}
	defer dckr.Close()

	var (
		ticker       = time.NewTicker(60 * time.Second)
		getGoing     = make(chan struct{}, 1)
		sigchan      = make(chan os.Signal, 1)
		notification chan string
		stateToken   string
		keepRunning  = true
	)
	getGoing <- struct{}{}
	signal.Notify(sigchan, os.Interrupt, syscall.SIGTERM)
	go func() {
		for {
			notifications, err := client.Notify(context.Background(), &connect.Request[v1.NotifyRequest]{})
			if err != nil {
				log.WithError(err).Error("cannot establish notification stream")
				time.Sleep(5 * time.Second)
				continue
			}
			for notifications.Receive() {
				notification <- notifications.Msg().StateToken
			}
		}
	}()
	for keepRunning {
		select {
		case <-ticker.C:
		case <-getGoing:
		case stateToken = <-notification:
			log.WithField("stateToken", stateToken).Info("got notification")
		case <-sigchan:
			keepRunning = false
			log.Info("got signal, shutting down")
			continue
		}

		log.Info("pulling resources")
		resources, err := client.PullResources(context.Background(), &connect.Request[v1.PullResourcesRequest]{
			Msg: &v1.PullResourcesRequest{
				StateToken: stateToken,
			},
		})
		if err != nil {
			panic(err)
		}
		for _, res := range resources.Msg.Resources {
			var (
				update bool
				err    error
			)
			switch {
			case res.GetWorkspace() != nil:
				update, err = handleWorkspace(context.Background(), dckr, res.GetWorkspace())
			default:
				log.WithField("resource", res).Warn("unknown resource type")
			}
			if err != nil {
				log.WithError(err).WithField("resource", res).Error("cannot handle resource")
			}
			if update {
				log.WithField("resource", res).Info("updating resource")
				_, err = client.UpdateResource(context.Background(), &connect.Request[v1.UpdateResourceRequest]{
					Msg: &v1.UpdateResourceRequest{
						Resource: res,
					},
				})
				if err != nil {
					log.WithError(err).WithField("resource", res).Error("cannot update resource")
				}
			}
		}
	}
}

func handleWorkspace(ctx context.Context, dckr *docker.Client, ws *v1.Workspace) (update bool, err error) {
	log.WithField("workspace", ws.Metadata.Name).Info("handling workspace")
	container, err := dckr.ContainerList(ctx, types.ContainerListOptions{
		Filters: filters.NewArgs(filters.Arg("name", "gitpod-ws-"+ws.Metadata.Name)),
	})
	if err != nil {
		return false, err
	}

	if ws.Status == nil {
		ws.Status = &v1.WorkspaceStatus{}
	}

	if len(container) == 0 {
		log.WithField("workspace", ws).Info("starting new workspace")
		ws.Status.Phase = v1.WorkspacePhase_WORKSPACE_PHASE_CREATING
		// TODO: start new workspace
		return true, nil
	}

	ws.Status.Phase = v1.WorkspacePhase_WORKSPACE_PHASE_RUNNING
	return true, nil
}
