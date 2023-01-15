// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	prefixed "github.com/x-cray/logrus-prefixed-formatter"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"

	supervisorapi "github.com/gitpod-io/gitpod/supervisor/api"
)

var innerLoopOpts struct {
	Headless bool
}

var innerLoopCmd = &cobra.Command{
	Use:   "inner-loop",
	Short: "innerLoop Test",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()

		log.Log = logrus.WithFields(logrus.Fields{})
		logrus.SetReportCaller(false)
		log.Log.Logger.SetFormatter(&prefixed.TextFormatter{
			TimestampFormat: "2006-01-02 15:04:05",
			FullTimestamp:   true,
			ForceFormatting: true,
			ForceColors:     true,
		})

		const socketFN = "/.supervisor/debug-service.sock"

		conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.WithError(err).Fatal("could not dial context")
		}
		defer conn.Close()

		client := daemonapi.NewDebugServiceClient(conn)
		resp, err := client.Start(context.Background(), &daemonapi.StartRequest{Headless: innerLoopOpts.Headless})
		if err != nil {
			log.WithError(err).Fatal("could not retrieve workspace info")
		}
		r, w := io.Pipe()
		reader := bufio.NewReader(r)
		go func() {
			for {
				data, err := resp.Recv()
				if err == io.EOF {
					w.Close()
					break
				}
				if err != nil {
					if s := status.Convert(err); s != nil {
						log.Fatal(s.Message())
						return
					}
					log.Fatal(err.Error())
				}
				if d := data.GetData(); d != nil {
					_, _ = w.Write(d)
				}
			}
		}()

		for {
			line, _, err := reader.ReadLine()
			if err != nil {
				if err == io.EOF {
					return
				}
				log.Fatal(err.Error())
			}
			msg := make(logrus.Fields)
			err = json.Unmarshal(line, &msg)
			if err != nil {
				continue

			}
			message := fmt.Sprintf("%v", msg["message"])
			level, err := logrus.ParseLevel(fmt.Sprintf("%v", msg["level"]))
			if err != nil {
				level = logrus.DebugLevel
			}
			if level == logrus.FatalLevel {
				level = logrus.ErrorLevel
			}

			delete(msg, "message")
			delete(msg, "level")
			delete(msg, "file")
			delete(msg, "func")
			delete(msg, "serviceContext")
			delete(msg, "time")
			delete(msg, "severity")
			delete(msg, "@type")

			if fmt.Sprintf("%v", msg["debugWorkspace"]) == "true" {
				workspaceUrl := fmt.Sprintf("%v", msg["workspaceUrl"])
				// TODO ssh link too
				sep := strings.Repeat("=", len(message))
				log.Info("\n" + sep + "\n\n\n" + message + "\n\n\n" + sep)
				go func() {
					err := notify(workspaceUrl, message)
					if err != nil {
						log.WithError(err).Error("failed to notify")
					}
				}()
			} else {
				log.Log.WithFields(msg).Log(level, message)
			}
		}
	},
}

func notify(workspaceUrl string, message string) error {
	conn := dialSupervisor()
	defer conn.Close()

	client := supervisorapi.NewNotificationServiceClient(conn)

	response, err := client.Notify(context.Background(), &supervisorapi.NotifyRequest{
		Level:   supervisorapi.NotifyRequest_INFO,
		Message: message,
		Actions: []string{"Open Browser"},
	})
	if err != nil {
		return err
	}
	if response.Action == "Open Browser" {
		gpPath, err := exec.LookPath("gp")
		if err != nil {
			return err
		}
		gpCmd := exec.Command(gpPath, "preview", "--external", workspaceUrl)
		gpCmd.Stdout = os.Stdout
		gpCmd.Stderr = os.Stderr
		return gpCmd.Run()
	}
	return nil
}

func init() {
	rootCmd.AddCommand(innerLoopCmd)
	innerLoopCmd.Flags().BoolVar(&innerLoopOpts.Headless, "headless", false, "running debug workspace in headless mode")
}
