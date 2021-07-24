// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/retry"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	wsdapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// workspacesForceFinalizationCmd represents the describe command
var workspacesForceFinalizationCmd = &cobra.Command{
	Use:   "force-finalize <workspaceID>",
	Short: "forces workspace finalization",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		log := log.WithField("instanceID", args[0])

		cfg, namespace, err := getKubeconfig()
		if err != nil {
			log.Fatal(err)
			return
		}
		clientSet, err := kubernetes.NewForConfig(cfg)
		if err != nil {
			log.Fatal(err)
			return
		}

		_, err = backupContent(ctx, cfg, clientSet, namespace, args[0])
		var mark string
		if err == nil {
			log.Info("workspace backup complete")
			mark = `{"backupComplete":true}`
		} else {
			log.WithError(err).Error("failed to backup content")
			mark = `{"backupComplete":true, "backupFailure":"The workspace data has been lost due to catastrophic system failure. Failed to backup workspace content."}`
		}
		err = markWorkspace(ctx, clientSet, namespace, fmt.Sprintf("ws-%s", args[0]), addMark("gitpod.io/disposalStatus", mark))
		if err != nil {
			log.Fatal(err)
		}
		log.WithField("disposalStatus", mark).Info("added disposalStatus annotation")
	},
}

func backupContent(ctx context.Context, cfg *rest.Config, clientSet *kubernetes.Clientset, namespace, instanceID string) (*wsdapi.DisposeWorkspaceResponse, error) {
	conn, client, err := getWorkspacesClient(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	req, err := client.DescribeWorkspace(ctx, &api.DescribeWorkspaceRequest{Id: instanceID})
	if err != nil {
		return nil, err
	}

	pods, err := clientSet.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("component=ws-daemon"),
	})
	var wsd string
	for _, p := range pods.Items {
		if p.Spec.NodeName == req.Status.Runtime.NodeName {
			wsd = p.Name
			break
		}
	}
	if wsd == "" {
		return nil, err
	}

	port := fmt.Sprintf("20203:8080")
	readychan, errchan := util.ForwardPort(ctx, cfg, namespace, wsd, port)
	select {
	case <-readychan:
	case err := <-errchan:
		return nil, err
	case <-ctx.Done():
		return nil, err
	}

	certPool, err := util.CertPoolFromSecret(clientSet, namespace, "ws-daemon-tls", []string{"ca.crt"})
	if err != nil {
		return nil, err
	}
	cert, err := util.CertFromSecret(clientSet, namespace, "ws-daemon-tls", "tls.crt", "tls.key")
	if err != nil {
		return nil, err
	}
	creds := credentials.NewTLS(&tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      certPool,
		ServerName:   "wsdaemon",
	})

	wsdconn, err := grpc.Dial("localhost:20203", grpc.WithTransportCredentials(creds))
	if err != nil {
		return nil, err
	}

	wsdc := wsdapi.NewWorkspaceContentServiceClient(wsdconn)
	resp, err := wsdc.DisposeWorkspace(ctx, &wsdapi.DisposeWorkspaceRequest{
		Id:     instanceID,
		Backup: true,
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func markWorkspace(ctx context.Context, clientSet kubernetes.Interface, namespace, podName string, annotations ...*annotation) error {
	// Retry on failure. Sometimes this doesn't work because of concurrent modification. The Kuberentes way is to just try again after waiting a bit.
	err := retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		pod, err := clientSet.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if pod == nil {
			return xerrors.Errorf("pod %s does not exist", podName)
		}

		for _, a := range annotations {
			a.Apply(pod.Annotations)
		}

		_, err = clientSet.CoreV1().Pods(namespace).Update(ctx, pod, metav1.UpdateOptions{})
		return err
	})
	if err != nil {
		an := make([]string, len(annotations))
		for i, a := range annotations {
			if a.Delete {
				an[i] = "-" + a.Name
			} else {
				an[i] = "+" + a.Name
			}
		}
		return xerrors.Errorf("cannot mark workspace %s with %v: %w", podName, strings.Join(an, ", "), err)
	}

	return nil
}

func addMark(name, value string) *annotation {
	return &annotation{name, value, false}
}

func deleteMark(name string) *annotation {
	return &annotation{name, "", true}
}

// annotation is a piece of metadata added to a workspace
type annotation struct {
	Name   string
	Value  string
	Delete bool
}

func (a *annotation) Apply(dst map[string]string) (needsUpdate bool) {
	_, wasPresent := dst[a.Name]
	if a.Delete {
		needsUpdate = wasPresent
		delete(dst, a.Name)
	} else {
		needsUpdate = !wasPresent
		dst[a.Name] = a.Value
	}
	return
}

func init() {
	workspacesCmd.AddCommand(workspacesForceFinalizationCmd)
}
