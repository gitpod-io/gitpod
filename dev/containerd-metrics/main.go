// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/containerd/containerd"
	apievents "github.com/containerd/containerd/api/events"
	"github.com/containerd/containerd/events"
	"github.com/containerd/typeurl"
	cli "github.com/urfave/cli/v2"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	"github.com/gitpod-io/gitpod/common-go/log"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
)

func main() {
	app := &cli.App{
		Commands: []*cli.Command{
			{
				Name:  "export",
				Usage: "Starts exporting metrics",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:      "socket",
						TakesFile: true,
						Usage:     "path to the containerd socket",
						Required:  true,
					},
					&cli.StringFlag{
						Name:  "namespace",
						Usage: "kubernetes namespace",
						Value: "default",
					},
					&cli.BoolFlag{
						Name:  "verbose",
						Value: false,
					},
				},
				Action: func(c *cli.Context) error {
					log.Init("containerd-metrics", "", true, c.Bool("verbose"))
					return serveContainerdMetrics(c.String("socket"), c.String("namespace"))
				},
			},
		},
	}
	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}

type Prep struct {
	T      time.Time
	Parent string
	Name   string
}
type Commit struct {
	PrepT  time.Time
	Dur    time.Duration
	Parent string
	Name   string
	Key    string
}

type Image struct {
	Name      string
	TotalPrep time.Duration
	Layer     []Layer
}

type Layer struct {
	T      time.Time
	ID     string
	Key    string
	Prep   time.Duration
	Parent string
}

var (
	prepByKey    = make(map[string]*Prep)
	commitByKey  = make(map[string]*Commit)
	commitByName = make(map[string]*Commit)
)

func serveContainerdMetrics(socket, namespace string) error {
	k8s, err := rest.InClusterConfig()
	if err != nil {
		return err
	}
	clientSet, err := kubernetes.NewForConfig(k8s)
	if err != nil {
		return err
	}
	lw := cache.NewFilteredListWatchFromClient(clientSet.CoreV1().RESTClient(), "pods", namespace, func(options *metav1.ListOptions) {
		options.LabelSelector = "gpwsman=true"
	})
	informer := cache.NewSharedIndexInformer(lw, &corev1.Pod{}, 300*time.Second, cache.Indexers{
		"instanceID": instanceIDIndex,
	})
	stop := make(chan struct{})
	defer close(stop)
	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			idx, _ := instanceIDIndex(obj)
			log.WithField("idx", idx).Debug("found new pod")
		},
	})
	go informer.Run(stop)

	log.Info("waiting for Kubernetes cache sync")
	cache.WaitForCacheSync(stop, informer.HasSynced)
	log.Info("Kubernetes cache synced")

	client, err := containerd.New(socket, containerd.WithDefaultNamespace("k8s.io"))
	if err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	evts, errs := client.EventService().Subscribe(ctx)
	for {
		var e *events.Envelope
		select {
		case err := <-errs:
			return err
		case <-sigChan:
			return nil
		case e = <-evts:
		}

		evt, err := typeurl.UnmarshalAny(e.Event)
		if err != nil {
			log.WithError(err).Warn("skipping event")
			continue
		}

		switch evt := evt.(type) {
		case *apievents.SnapshotPrepare:
			if _, exists := prepByKey[evt.Key]; exists {
				log.WithField("obj", *prepByKey[evt.Key]).Debug("ignoring duplicate prep")
				continue
			}
			prepByKey[evt.Key] = &Prep{
				T:      time.Now(),
				Parent: evt.Parent,
			}
			log.WithField("obj", *prepByKey[evt.Key]).Debug("prep")
		case *apievents.SnapshotCommit:
			p, ok := prepByKey[evt.Key]
			if !ok {
				log.WithField("key", evt.Key).WithField("name", evt.Name).Debug("found commit without prep")
				continue
			}
			c := &Commit{
				PrepT:  p.T,
				Dur:    time.Since(p.T),
				Name:   evt.Name,
				Parent: p.Parent,
				Key:    evt.Key,
			}
			if _, exists := commitByKey[evt.Key]; exists {
				log.WithField("obj", *c).Debug("ignoring duplicate commit")
				continue
			}
			commitByKey[evt.Key] = c
			commitByName[evt.Name] = c
			log.WithField("obj", *c).Debug("commit")
		case *apievents.SnapshotRemove:
			log.WithField("obj", evt).Info("snapshot remove")
		case *apievents.ImageDelete:
			log.WithField("obj", evt).Info("image delete")
		case *apievents.ContainerCreate:
			segs := strings.Split(evt.Image, "/")
			var instanceID string
			if len(segs) == 3 {
				segs = strings.Split(segs[2], ":")
				instanceID = segs[0]
			}
			imageSpec := getImageSpec(instanceID, informer)
			pushContainerMetrics(evt.ID, evt.Image, instanceID, imageSpec)
		}
	}
}

func instanceIDIndex(obj interface{}) ([]string, error) {
	meta, err := meta.Accessor(obj)
	if err != nil {
		return []string{""}, fmt.Errorf("object has no meta: %v", err)
	}
	return []string{meta.GetLabels()["workspaceID"]}, nil
}

func getImageSpec(instanceID string, informer cache.SharedIndexInformer) *regapi.ImageSpec {
	if instanceID == "" {
		return nil
	}
	objs, _ := informer.GetIndexer().ByIndex("instanceID", instanceID)
	if len(objs) == 0 {
		return nil
	}
	pod, ok := objs[0].(*corev1.Pod)
	if !ok {
		return nil
	}

	ispec := pod.Annotations["gitpod/imageSpec"]
	spec, err := regapi.ImageSpecFromBase64(ispec)
	if err != nil {
		log.WithError(err).WithField("instanceId", instanceID).Debug("cannot decode image spec")
		return nil
	}

	return spec
}

func pushContainerMetrics(id, image, instanceID string, imageSpec *regapi.ImageSpec) {
	var img Image
	img.Name = image

	initialPrep, ok := prepByKey[id]
	if !ok {
		log.WithField("image", image).WithField("id", id).Debug("image witout prep")
		return
	}

	var c *Commit
	c, ok = commitByName[initialPrep.Parent]
	for ok {
		img.Layer = append(img.Layer, Layer{
			T:      c.PrepT,
			ID:     c.Name,
			Key:    c.Key,
			Prep:   c.Dur,
			Parent: c.Parent,
		})
		img.TotalPrep += c.Dur
		c, ok = commitByName[c.Parent]
	}

	for i, j := 0, len(img.Layer)-1; i < j; i, j = i+1, j-1 {
		img.Layer[i], img.Layer[j] = img.Layer[j], img.Layer[i]
	}

	var (
		originalImage string
		ideImage      string
		isWorkspace   bool
	)
	if imageSpec != nil {
		originalImage = imageSpec.BaseRef
		ideImage = imageSpec.IdeRef
		isWorkspace = true
	}

	log.WithFields(map[string]interface{}{
		"instanceId":       instanceID,
		"image":            img,
		"id":               id,
		"isWorkspace":      isWorkspace,
		"originalImageRef": originalImage,
		"ideImageRef":      ideImage,
	}).Info("image pulled")
}
