// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	logging "cloud.google.com/go/logging/apiv2"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/compute/v1"
	loggingpb "google.golang.org/genproto/googleapis/logging/v2"
)

func PullGapListener(ctx context.Context) {
	go func() {
		for retry := 0; retry < 10; retry++ {
			err := listenToLogs(ctx)
			if err == nil {
				return
			}
			log.Error(err)
		}
		log.Error("Pull gap listener reached max number of restarts. Stopping")
	}()
}

type workspaceEntry struct {
	id                                        string
	kubeletPullStart, registryFacadePullStart *time.Time
	kind                                      string
}

const gcInterval = 1 * time.Hour

var (
	logEntries        = make(map[string]*workspaceEntry)
	gapsLoggedSinceGC = 0
	nodeName          string
)

func listenToLogs(ctx context.Context) error {
	fmt.Print("Hi")
	log.Info("Creating GCE logging client")
	c, err := logging.NewClient(ctx)
	if err != nil {
		return err
	}

	log.Info("Creating tail log stream")
	stream, err := c.TailLogEntries(ctx)
	if err != nil {
		return err
	}

	log.Info("Getting GCE projectID")
	credentials, err := google.FindDefaultCredentials(ctx, compute.ComputeScope)
	if err != nil {
		return err
	}
	projectID := credentials.ProjectID
	if projectID == "" {
		log.Error("GCE projectID not set in credential file. Using 'gitpod-191109'")
		projectID = "gitpod-191109"
	}

	nodeName = os.Getenv("NODENAME")
	if nodeName == "" {
		return fmt.Errorf("Environment variable NODENAME not set")
	}
	log.WithField("nodeName", nodeName).Info("Setting nodeName")

	log.Info("Registering log query")
	resourceNames := []string{fmt.Sprintf("projects/%s", projectID)}
	req := &loggingpb.TailLogEntriesRequest{
		ResourceNames: resourceNames,
		Filter: fmt.Sprintf(`
			(
				jsonPayload.source.component="kubelet"
				jsonPayload.message=~"Pulling image"
				jsonPayload.source.host="%s"
			) OR (
				labels.k8s-pod/component="registry-facade"
				labels.k8s-pod/gitpod_io/nodeService="registry-facade"
				jsonPayload.message="get manifest"
				(jsonPayload.name!=undefined OR jsonPayload.instanceId!=undefined)			
				labels."compute.googleapis.com/resource_name"="%s"
			)
		`, nodeName, nodeName),
	}
	if err := stream.Send(req); err != nil {
		return err
	}
	defer stream.CloseSend()

	gcTicker := time.NewTicker(gcInterval)
	defer gcTicker.Stop()

	log.Info("Waiting for logs")
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			log.Info("Log stream closed. Exiting")
			return nil
		}
		if err != nil {
			return err
		}
		for _, logEntry := range resp.Entries {
			timestamp := logEntry.Timestamp.AsTime()
			jsonPayload := logEntry.GetJsonPayload()
			if jsonPayload == nil {
				continue
			}
			if logEntry.Resource.Labels["container_name"] == "registry-facade" {
				// registry-facade log "get manifest"
				wsId := jsonPayload.Fields["name"].GetStringValue()
				if wsId == "" {
					wsId = jsonPayload.Fields["instanceId"].GetStringValue()
					if wsId == "" {
						log.WithField("logEntry", logEntry).Error("registry-facade log must either have a jsonPayload.name or a jsonPayload.instanceId")
						continue
					}
				}
				entry := logEntries[wsId]
				if entry == nil {
					entry = &workspaceEntry{
						id: wsId,
					}
					logEntries[wsId] = entry
				}
				if entry.registryFacadePullStart != nil {
					continue
				}
				log.WithField("workspaceId", wsId).Debug("Received manifest pull log from registry-facade")
				entry.registryFacadePullStart = &timestamp
				logGap(entry)
			} else {
				// kubelet log "Pulling image...."
				involvedObject := jsonPayload.Fields["involvedObject"].GetStructValue()
				if involvedObject == nil {
					log.WithField("logEntry", logEntry).Error("kubelet log entry lacks jsonPayload.involvedObject")
					continue
				}
				prefixedWsId := involvedObject.Fields["name"].GetStringValue()
				if prefixedWsId == "" {
					log.WithField("logEntry", logEntry).Error("kubelet log entry lacks jsonPayload.involvedObject.name")
					continue
				}
				firstDash := strings.Index(prefixedWsId, "-")
				wsId := prefixedWsId[firstDash+1:]
				entry := logEntries[wsId]
				if entry == nil {
					entry = &workspaceEntry{
						id: wsId,
					}
					logEntries[wsId] = entry
				}
				if entry.kubeletPullStart != nil {
					continue
				}
				kind := prefixedWsId[:firstDash]
				log.WithField("workspaceId", wsId).WithField("kind", kind).Debug("Received pull start log from kubelet")
				entry.kubeletPullStart = &timestamp
				entry.kind = kind
				logGap(entry)
			}
		}
		select {
		case <-gcTicker.C:
			collectGarbage()
		case <-ctx.Done():
			return nil
		default:
			continue
		}
	}
}

func logGap(entry *workspaceEntry) {
	if entry.registryFacadePullStart != nil && entry.kubeletPullStart != nil {
		gap := entry.registryFacadePullStart.Sub(*entry.kubeletPullStart).Seconds()
		bermudaGapDuration.WithLabelValues(nodeName).Observe(gap)
		logEntry(entry).WithField("gapInSeconds", gap).Info("Gap between kubelet pull and registry facade pull")
		gapsLoggedSinceGC++
	}
}

func collectGarbage() {
	now := time.Now()
	deleted := 0
	for wsId, entry := range logEntries {
		if (entry.kubeletPullStart == nil || now.Sub(*entry.kubeletPullStart) < gcInterval) &&
			(entry.registryFacadePullStart == nil || now.Sub(*entry.registryFacadePullStart) < gcInterval) {
			continue
		}
		if entry.kubeletPullStart == nil || entry.registryFacadePullStart == nil {
			logEntry(entry).Warning("Removing dangling entry for timeout")
		}
		deleted++
		delete(logEntries, wsId)
	}
	log.WithField("loggedGaps", gapsLoggedSinceGC).WithField("remainingEntries", len(logEntries)).WithField("deletedEntries", deleted).Debug("Garbage collected")
	gapsLoggedSinceGC = 0
}

func logEntry(entry *workspaceEntry) *logrus.Entry {
	l := log.WithField("workspaceId", entry.id).WithField("kind", entry.kind).WithField("nodeId", nodeName)
	if entry.registryFacadePullStart != nil {
		l = l.WithField("registryFacadePullStart", entry.registryFacadePullStart.Format(time.RFC3339))
	}
	if entry.kubeletPullStart != nil {
		l = l.WithField("kubeletPullStart", entry.kubeletPullStart.Format(time.RFC3339))
	}
	return l
}
