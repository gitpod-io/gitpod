package supervisor

import (
	"context"
	"io"

	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
)

func GetTasksList(ctx context.Context, client api.StatusServiceClient) []*api.TaskStatus {
	// TODO(andreafalzetti): ask how to opt-out from the stream! {Observe: false} gives me a stream 😢
	listen, err := client.TasksStatus(ctx, &api.TasksStatusRequest{Observe: false})
	if err != nil {
		log.WithError(err).Error("Cannot list tasks")
	}

	taskschan := make(chan []*api.TaskStatus)

	go func() {
		for {
			resp, err := listen.Recv()
			if err != nil && err != io.EOF {
				panic(err)
			}

			chunk := resp.GetTasks()

			if chunk == nil {
				close(taskschan)
				break
			} else {
				taskschan <- chunk
			}
		}
	}()

	return <-taskschan
}
