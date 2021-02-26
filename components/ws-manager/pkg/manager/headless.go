// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"strings"
	"sync"
	"time"

	"golang.org/x/xerrors"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// HeadlessListener can listen to workspace pods, parse the Theia produced output and notify a consumer
type HeadlessListener struct {
	OnHeadlessDone func(pod *corev1.Pod, failed bool)
	OnHeadlessLog  func(pod *corev1.Pod, log string)
	LogLineHandler func(pod *corev1.Pod, line string) (continueListening bool)

	clientset kubernetes.Interface
	namespace string

	listeners     map[string]bool
	listenersLock *sync.Mutex

	logStreamProvider func(pod *corev1.Pod, container string, from time.Time) (io.ReadCloser, error)
	listenerTimeout   time.Duration
}

// NewHeadlessListener creates a structure that maintains a group of listeners which interprete Theia output for headless workspaces
func NewHeadlessListener(clientset kubernetes.Interface, namespace string) *HeadlessListener {
	hl := &HeadlessListener{
		clientset:       clientset,
		namespace:       namespace,
		listeners:       make(map[string]bool),
		listenersLock:   &sync.Mutex{},
		listenerTimeout: listenerTimeout,
		OnHeadlessDone:  func(pod *corev1.Pod, failed bool) {},
		OnHeadlessLog:   func(pod *corev1.Pod, log string) {},
	}
	hl.logStreamProvider = hl.kubernetesLogStreamProvider
	hl.LogLineHandler = hl.handleLogLine
	return hl
}

func (hl *HeadlessListener) kubernetesLogStreamProvider(pod *corev1.Pod, container string, from time.Time) (io.ReadCloser, error) {
	req := hl.clientset.CoreV1().Pods(hl.namespace).GetLogs(pod.Name, &corev1.PodLogOptions{
		Container:  container,
		Previous:   false,
		Timestamps: true, // we need timestamps to tell whether we have read a certain line already
		Follow:     true,
		SinceTime:  &metav1.Time{Time: from},
	})
	logs, err := req.Stream(context.Background())
	if err != nil {
		return nil, err
	}

	return logs, nil
}

// Listen starts listening to a pod until the pod is stopped or the context is canceled
func (hl *HeadlessListener) Listen(ctx context.Context, pod *corev1.Pod) error {
	hl.listenersLock.Lock()
	if _, alreadyListening := hl.listeners[pod.Name]; alreadyListening {
		hl.listenersLock.Unlock()
		return nil
	}
	hl.listeners[pod.Name] = true
	hl.listenersLock.Unlock()

	err := hl.listenAndRetry(ctx, pod, "workspace")
	if err != nil {
		return err
	}

	return nil
}

func (hl *HeadlessListener) handleLogLine(pod *corev1.Pod, line string) (continueListening bool) {
	var taskMsg taskLogMessage
	var originalMsg workspaceLogMessage
	err := json.Unmarshal([]byte(line), &originalMsg)
	if err != nil {
		var legacyOriginalMsg theiaLogMessage
		err := json.Unmarshal([]byte(line), &legacyOriginalMsg)
		if err != nil || legacyOriginalMsg.Component != "workspace" {
			return true
		}
		taskMsg = legacyOriginalMsg.Message
	} else {
		if originalMsg.Component != "workspace" {
			return true
		}
		taskMsg = originalMsg.Message
	}
	if taskMsg.Type == "workspaceTaskOutput" {
		hl.OnHeadlessLog(pod, taskMsg.Data)
		return true
	}

	log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithField("type", taskMsg.Type).Info("headless workspace is done")
	if taskMsg.Type == "workspaceTaskFailed" || taskMsg.Type == "workspaceTaskDone" {
		hl.OnHeadlessDone(pod, taskMsg.Type == "workspaceTaskFailed")
		return false
	}

	log.WithField("type", taskMsg.Type).Warn("unknown headless log type")
	return true
}

type taskLogMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

type workspaceLogMessage struct {
	Message   taskLogMessage `json:"taskLogMsg"`
	Component string         `json:"component"`
}

//region backward compatibility
type theiaLogMessage struct {
	Message   taskLogMessage `json:"message"`
	Component string         `json:"component"`
}

//endregion

const (
	// timeout in seconds, default 3 seconds. Actual timeout is this number multiplied by the number of retries.
	listenerTimeout = 3 * time.Second

	// number of retries after timeout without data being send
	// with 50 retries and 3 seconds timeout we cover ~60 minutes of inactivity
	listenerAttempts = 50
)

type channelCloser struct {
	Delegate io.Closer
	C        chan struct{}

	once sync.Once
}

func (cc *channelCloser) Close() (err error) {
	cc.once.Do(func() {
		close(cc.C)
		err = cc.Delegate.Close()
	})
	return
}

// The Kubernetes log stream just stops sending new content at some point without any notice or error (see see https://github.com/kubernetes/kubernetes/issues/59477).
// This function times out if we don't see any log output in a certain amount of time (with linear back off). Upon timeout, we try and reconnect
// to the log output.
func (hl *HeadlessListener) listenAndRetry(ctx context.Context, pod *corev1.Pod, container string) (err error) {
	owi := wsk8s.GetOWIFromObject(&pod.ObjectMeta)
	err = ctx.Err()
	if err != nil {
		return err
	}

	// We have two Go routines here: one that tries to read from the pod and gets restarted every now and then,
	// and the "gouvernor" which initiates said restarting (defined below).
	lastLineReadChan := make(chan string)
	startListener := func(from time.Time) (stopListening io.Closer, err error) {
		logs, err := hl.logStreamProvider(pod, container, from)
		if err != nil {
			return nil, err
		}

		closer := &channelCloser{
			C:        make(chan struct{}),
			Delegate: logs,
		}
		go func() {
			log.Debug("Start listener")
			scanner := bufio.NewScanner(logs)
			for scanner.Scan() {
				l := scanner.Text()
				if len(l) == 0 {
					continue
				}
				select {
				case lastLineReadChan <- l:
				case <-closer.C:
					// logs were closed while we were trying to send to lastLineReadChan.
					// This is as good as if the scanner were closed and Scan() returned false.
					break
				}
			}

			// Note: we deliberately do not handle a scanner error here. That's because
			// err'ing here is not much of a problem as the timeout will catch this. We're not even logging errors here
			// as they have little to say. If a pod disappears or we fail to read its logs, we'll just retry the next time around.
			//
			// It's dangerous to explicitely restart the the listener if the scanner fails (e.g. using a channel to the gouvernor),
			// as this easily results in an infinite loop. A previous design of this program suffered from exactly this issue.
		}()

		return closer, nil
	}

	// try and connect for the first time - if that fails, we're done
	if pod.Status.StartTime == nil {
		return xerrors.Errorf("pod is not running")
	}
	fromPodStartup := pod.Status.StartTime.Time
	logs, err := startListener(fromPodStartup)
	if err != nil {
		return err
	}

	// the gouvernor checks if the log read timed out of err'd. In either case it restarts the listener.
	timeout := time.NewTimer(hl.listenerTimeout)
	go func() {
		var (
			attempts = 0

			from    = fromPodStartup
			oldLogs = logs
			err     error
		)

		for {
			select {
			case <-ctx.Done():
				// context has finished/was canceled ... tear things down
				if oldLogs != nil {
					oldLogs.Close()
				}
				return

			case <-timeout.C:
				log.WithFields(owi).WithField("attempt", attempts).Debug("log listener timed out")

				// the timout timer has hit - tear things down and maybe restart
				if oldLogs != nil {
					oldLogs.Close()
				}

				attempts++
				if attempts >= listenerAttempts {
					// we're exhaused - let's stop trying
					log.WithFields(owi).WithError(err).WithField("attempt", attempts).Error("exhausted all attempts listening for log output")
					return
				}

				// reconnect (code duplication due to https://github.com/golang/go/issues/23196)
				oldLogs, err = startListener(from)
				if err != nil {
					// we failed to connect - wait for the timeout (without back-off) to try again
					log.WithFields(owi).WithError(err).WithField("attempt", attempts).Warn("failed while attempting to re-connect to pod log output")
				}
				timeout.Reset(time.Duration(attempts) * hl.listenerTimeout)

			case line := <-lastLineReadChan:
				// we split on the first whitespace. format is "<date> <message>"
				parts := strings.SplitN(line, " ", 2)

				ts, err := time.Parse(time.RFC3339Nano, parts[0])
				if err != nil {
					log.WithFields(owi).WithError(err).WithField("attempt", attempts).WithField("line", line).Error("cannot parse last log timestamp - discarding line")
					continue
				}

				// Kubernetes isn't precise when retrieving logs starting from a certain point in time (see https://github.com/kubernetes/kubernetes/issues/77856).
				// Thus we have to filter ourselves to prevent duplicate log lines.
				if ts.Sub(from) <= 0*time.Second {
					// line is older than the one we last read - ignore it
					continue
				}

				payload := parts[1]
				continueListening := hl.LogLineHandler(pod, payload)
				if !continueListening {
					log.WithFields(owi).Info("finished listening to log output")
					oldLogs.Close()
					return
				}

				from = ts
				attempts = 0

				// we've just seen a line - reset the timer after draining it. This is not done conccurent with other receives as only this
				// goroutine receives from the timer channel.
				if !timeout.Stop() {
					<-timeout.C
				}
				timeout.Reset(hl.listenerTimeout)
			}

		}
	}()

	return nil
}
