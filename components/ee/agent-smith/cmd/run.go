// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	slack "github.com/ashwanthkumar/slack-go-webhook"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/agent"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts agent smith",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := getConfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		reg := prometheus.DefaultRegisterer
		if cfg.PrometheusAddr != "" {
			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.Handler())

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}

		smith, err := agent.NewAgentSmith(cfg.Config)
		if err != nil {
			log.WithError(err).Fatal("cannot create agent smith")
		}

		err = smith.RegisterMetrics(reg)
		if err != nil {
			log.WithError(err).Fatal("cannot register metrics")
		}

		ctx := context.Background()
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()

		go smith.Start(ctx, func(violation agent.InfringingWorkspace, penalties []agent.PenaltyKind) {
			log.WithField("violation", violation).WithField("penalties", penalties).Info("Found violation")

			if cfg.SlackWebhooks != nil {
				for _, i := range violation.Infringements {
					// Need to set err to nil to eliminate the chance of logging previous errors after the loop.
					err = nil

					if i.Kind.Severity() == agent.InfringementSeverityAudit {
						err = notifySlack(cfg.SlackWebhooks.Audit, cfg.HostURL, violation, penalties)
						break
					} else if i.Kind.Severity() != agent.InfringementSeverityBarely {
						err = notifySlack(cfg.SlackWebhooks.Warning, cfg.HostURL, violation, penalties)
						break
					}
				}
				if err != nil {
					log.WithError(err).Warn("error while notifying Slack")
				}

				// Don't send a slack message in case the infrignments are only "barely severe"
				return
			}
		})

		if cfg.MaxSysMemMib > 0 {
			go startMemoryWatchdog(cfg.MaxSysMemMib)
		}

		log.WithField("namespace", cfg.Namespace).Info("agent smith is up and running")

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

		select {
		case <-ctx.Done():
			return
		case <-sigChan:
			return
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

func startMemoryWatchdog(maxSysMemMib uint64) {
	t := time.NewTicker(30 * time.Second)
	var m runtime.MemStats
	for {
		runtime.ReadMemStats(&m)

		sysMemMib := m.Sys / 1024 / 1024
		if sysMemMib > maxSysMemMib {
			log.WithField("sysMemMib", sysMemMib).WithField("maxSysMemMib", maxSysMemMib).Fatal("reached maxmimum memory use - stopping")
		}

		<-t.C
	}
}

func notifySlack(webhook string, hostURL string, ws agent.InfringingWorkspace, penalties []agent.PenaltyKind) error {
	var (
		region           = os.Getenv("GITPOD_REGION")
		lblDetails       = "Details"
		lblActions       = "Actions"
		lblPenalties     = "Penalties"
		lblInfringements = "Long Infringements details"
	)

	attachments := []slack.Attachment{
		{
			Title: &lblDetails,
			Fields: []*slack.Field{
				{Title: "pod", Value: ws.Pod},
				{Title: "owner", Value: ws.Owner},
				{Title: "workspace", Value: ws.WorkspaceID},
				{Title: "region", Value: region},
			},
		},
	}
	if len(penalties) > 0 {
		vs := make([]*slack.Field, len(penalties))
		for i, p := range penalties {
			vs[i] = &slack.Field{Title: "enforced", Value: string(p)}
		}
		attachments = append(attachments, slack.Attachment{
			Title:  &lblPenalties,
			Fields: vs,
		})
	}
	attachments = append(attachments,
		slack.Attachment{
			Title: &lblActions,
			Fields: []*slack.Field{
				{Title: "User Admin", Value: fmt.Sprintf("%s/admin/users/%s", hostURL, ws.Owner)},
				{Title: "Workspace Admin", Value: fmt.Sprintf("%s/admin/workspaces/%s", hostURL, ws.WorkspaceID)},
			},
			Actions: []*slack.Action{
				{Type: "button", Text: "Block User", Url: fmt.Sprintf("%s/api/enforcement/block-user/%s", hostURL, ws.Owner)},
			},
		},
	)

	infringements := make([]*slack.Field, len(ws.Infringements))
	for _, v := range ws.Infringements {
		infringements = append(infringements, &slack.Field{
			Title: string(v.Kind), Value: v.Description,
		})
	}

	attachments = append(attachments,
		slack.Attachment{Title: &lblInfringements, Fields: infringements},
	)

	payload := slack.Payload{
		Text:        fmt.Sprintf("Agent Smith: %s", ws.DescribeInfringements(150)),
		IconEmoji:   ":-(",
		Attachments: attachments,
	}

	errs := slack.Send(webhook, "", payload)
	if len(errs) > 0 {
		allerr := make([]string, len(errs))
		for i, err := range errs {
			allerr[i] = err.Error()
		}
		return xerrors.Errorf("notifySlack: %s", strings.Join(allerr, ", "))
	}

	return nil
}
