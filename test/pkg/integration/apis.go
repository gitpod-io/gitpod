// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"

	// Gitpod uses mysql, so it makes sense to make this DB driver available
	// by default.
	_ "github.com/go-sql-driver/mysql"
)

var (
	errNoSuitableUser = fmt.Errorf("no suitable user found: make sure there's at least one non-builtin user in the database (e.g. login)")
)

// API provides access to the individual component's API
func (t *Test) API() *ComponentAPI {
	if t.api == nil {
		t.api = &ComponentAPI{
			t: t,
		}
		t.api.serverStatus.Client = make(map[string]*gitpod.APIoverJSONRPC)
		t.api.serverStatus.Token = make(map[string]string)
	}
	return t.api
}

// ComponentAPI provides access to the individual component's API
type ComponentAPI struct {
	t *Test

	serverStatus struct {
		Token  map[string]string
		Client map[string]*gitpod.APIoverJSONRPC
	}
	wsmanStatus struct {
		Port   int
		Client wsmanapi.WorkspaceManagerClient
	}
	contentServiceStatus struct {
		Port              int
		BlobServiceClient csapi.BlobServiceClient
	}
	dbStatus struct {
		Port     int
		Password string
		DB       *sql.DB
	}
	imgbldStatus struct {
		Port   int
		Client imgbldr.ImageBuilderClient
	}
}

// Supervisor provides a gRPC connection to a workspace's supervisor
func (c *ComponentAPI) Supervisor(instanceID string) (res grpc.ClientConnInterface) {
	pod, _, err := c.t.selectPod(ComponentWorkspace, selectPodOptions{InstanceID: instanceID})
	if err != nil {
		c.t.t.Fatal(err)
	}

	localPort, err := getFreePort()
	if err != nil {
		c.t.t.Fatal(err)
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	ready, errc := forwardPort(ctx, c.t.restConfig, c.t.namespace, pod, fmt.Sprintf("%d:22999", localPort))
	select {
	case err = <-errc:
		cancel()
		c.t.t.Fatal(err)
		return nil
	case <-ready:
	}
	c.t.closer = append(c.t.closer, func() error { cancel(); return nil })

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", localPort), grpc.WithInsecure())
	if err != nil {
		c.t.t.Fatal(err)
		return
	}

	c.t.closer = append(c.t.closer, conn.Close)
	return conn
}

type gitpodServerOpts struct {
	User string
}

// GitpodServerOpt specificies Gitpod server access
type GitpodServerOpt func(*gitpodServerOpts) error

// WithGitpodUser specifies the user as which we want to access the API.
func WithGitpodUser(name string) GitpodServerOpt {
	return func(o *gitpodServerOpts) error {
		o.User = name
		return nil
	}
}

// GitpodServer provides access to the Gitpod server API
func (c *ComponentAPI) GitpodServer(opts ...GitpodServerOpt) (res gitpod.APIInterface) {
	var options gitpodServerOpts
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			c.t.t.Fatalf("cannot access Gitpod server API: %q", err)
			return
		}
	}

	if cl, ok := c.serverStatus.Client[options.User]; ok {
		return cl
	}

	err := func() error {
		tkn := c.serverStatus.Token[options.User]
		if tkn == "" {
			var err error
			tkn, err = c.createGitpodToken(options.User)
			if err != nil {
				return err
			}
			c.serverStatus.Token[options.User] = tkn
		}

		pods, err := c.t.clientset.CoreV1().Pods(c.t.namespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: "component=server",
		})
		if err != nil {
			return err
		}
		hostURL, err := envvarFromPod(pods, "HOST_URL")
		if err != nil {
			return err
		}
		if hostURL == "" {
			return xerrors.Errorf("did not find HOST_URL env var on server pod")
		}
		hostURL = strings.ReplaceAll(hostURL, "http://", "ws://")
		hostURL = strings.ReplaceAll(hostURL, "https://", "wss://")
		endpoint, err := url.Parse(hostURL)
		if err != nil {
			return err
		}
		endpoint.Path = "/api/v1"

		cl, err := gitpod.ConnectToServer(endpoint.String(), gitpod.ConnectToServerOpts{
			Token: tkn,
		})
		if err != nil {
			return err
		}

		c.serverStatus.Client[options.User] = cl
		res = cl
		c.t.closer = append(c.t.closer, cl.Close)

		return nil
	}()
	if errors.Is(err, errNoSuitableUser) {
		c.t.t.Skip(err)
		return nil
	}
	if err != nil {
		c.t.t.Fatalf("cannot access Gitpod server API: %q", err)
		return nil
	}

	return
}

func (c *ComponentAPI) createGitpodToken(user string) (tkn string, err error) {
	var (
		db  = c.DB()
		row *sql.Row
	)
	if user == "" {
		row = db.QueryRow(`SELECT id FROM d_b_user WHERE NOT id = "` + gitpodBuiltinUserID + `"`)
	} else {
		row = db.QueryRow("SELECT id FROM d_b_user WHERE name = ?", user)
	}

	var id string
	err = row.Scan(&id)
	if err == sql.ErrNoRows {
		return "", errNoSuitableUser
	}
	if err != nil {
		return "", xerrors.Errorf("cannot look for users: %w", err)
	}

	rawTkn, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	tkn = rawTkn.String()

	hash := sha256.New()
	hash.Write([]byte(tkn))
	hashVal := fmt.Sprintf("%x", hash.Sum(nil))

	// see https://github.com/gitpod-io/gitpod/blob/master/components/gitpod-protocol/src/protocol.ts#L274
	const tokenTypeMachineAuthToken = 1

	_, err = db.Exec("INSERT INTO d_b_gitpod_token (tokenHash, name, type, userId, scopes, created) VALUES (?, ?, ?, ?, ?, ?)",
		hashVal,
		fmt.Sprintf("integration-test-%d", time.Now().UnixNano()),
		tokenTypeMachineAuthToken,
		id,
		"resource:default,function:*",
		time.Now().Format(time.RFC3339),
	)
	if err != nil {
		return "", err
	}

	c.t.closer = append(c.t.closer, func() error {
		_, err := db.Exec("DELETE FROM d_b_gitpod_token WHERE tokenHash = ?", hashVal)
		return err
	})

	return tkn, nil
}

// Kubernetes provides access to the Kubernetes cluster we're connected to
func (c *ComponentAPI) Kubernetes() (cl kubernetes.Interface, namespace string) {
	return c.t.clientset, c.t.namespace
}

// WorkspaceManager provides access to ws-manager
func (c *ComponentAPI) WorkspaceManager() wsmanapi.WorkspaceManagerClient {
	var rerr error
	defer func() {
		if rerr == nil {
			return
		}

		c.t.t.Fatalf("cannot access ws-manager: %q", rerr)
	}()

	if c.wsmanStatus.Client != nil {
		return c.wsmanStatus.Client
	}
	if c.wsmanStatus.Port == 0 {
		pod, _, err := c.t.selectPod(ComponentWorkspaceManager, selectPodOptions{})
		if err != nil {
			rerr = err
			return nil
		}

		localPort, err := getFreePort()
		if err != nil {
			rerr = err
			return nil
		}

		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := forwardPort(ctx, c.t.restConfig, c.t.namespace, pod, fmt.Sprintf("%d:8080", localPort))
		select {
		case rerr = <-errc:
			cancel()
			return nil
		case <-ready:
		}
		c.t.closer = append(c.t.closer, func() error { cancel(); return nil })
		c.wsmanStatus.Port = localPort
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.wsmanStatus.Port), grpc.WithInsecure())
	if err != nil {
		rerr = err
		return nil
	}
	c.t.closer = append(c.t.closer, conn.Close)

	c.wsmanStatus.Client = wsmanapi.NewWorkspaceManagerClient(conn)
	return c.wsmanStatus.Client
}

// BlobService provides access to the blob service of the content service
func (c *ComponentAPI) BlobService() csapi.BlobServiceClient {
	var rerr error
	defer func() {
		if rerr == nil {
			return
		}

		c.t.t.Fatalf("cannot access blob service: %q", rerr)
	}()

	if c.contentServiceStatus.BlobServiceClient != nil {
		return c.contentServiceStatus.BlobServiceClient
	}
	if c.contentServiceStatus.Port == 0 {
		pod, _, err := c.t.selectPod(ComponentContentService, selectPodOptions{})
		if err != nil {
			rerr = err
			return nil
		}

		localPort, err := getFreePort()
		if err != nil {
			rerr = err
			return nil
		}

		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := forwardPort(ctx, c.t.restConfig, c.t.namespace, pod, fmt.Sprintf("%d:8080", localPort))
		select {
		case rerr = <-errc:
			cancel()
			return nil
		case <-ready:
		}
		c.t.closer = append(c.t.closer, func() error { cancel(); return nil })
		c.contentServiceStatus.Port = localPort
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.contentServiceStatus.Port), grpc.WithInsecure())
	if err != nil {
		rerr = err
		return nil
	}
	c.t.closer = append(c.t.closer, conn.Close)

	c.contentServiceStatus.BlobServiceClient = csapi.NewBlobServiceClient(conn)
	return c.contentServiceStatus.BlobServiceClient
}

// DB provides access to the Gitpod database.
// Callers must never close the DB.
func (c *ComponentAPI) DB() *sql.DB {
	if c.dbStatus.DB != nil {
		return c.dbStatus.DB
	}

	var rerr error
	defer func() {
		if rerr == nil {
			return
		}

		c.t.t.Fatalf("cannot access database: %q", rerr)
	}()

	if c.dbStatus.Port == 0 {
		svc, err := c.t.clientset.CoreV1().Services(c.t.namespace).Get(context.Background(), "db", metav1.GetOptions{})
		if err != nil {
			rerr = err
			return nil
		}
		pods, err := c.t.clientset.CoreV1().Pods(c.t.namespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: labels.SelectorFromSet(svc.Spec.Selector).String(),
		})
		if err != nil {
			rerr = err
			return nil
		}
		if len(pods.Items) == 0 {
			rerr = xerrors.Errorf("no pods for service %s found", svc.Name)
			return nil
		}
		var pod *corev1.Pod
		for _, p := range pods.Items {
			if p.Spec.NodeName == "" {
				// no node means the pod can't be ready
				continue
			}
			var isReady bool
			for _, cond := range p.Status.Conditions {
				if cond.Type == corev1.PodReady {
					isReady = cond.Status == corev1.ConditionTrue
					break
				}
			}
			if !isReady {
				continue
			}

			pod = &p
			break
		}
		if pod == nil {
			rerr = xerrors.Errorf("no active pod for service %s found", svc.Name)
			return nil
		}

		localPort, err := getFreePort()
		if err != nil {
			rerr = err
			return nil
		}
		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := forwardPort(ctx, c.t.restConfig, c.t.namespace, pod.Name, fmt.Sprintf("%d:3306", localPort))
		select {
		case err = <-errc:
			cancel()
			rerr = err
			return nil
		case <-ready:
		}
		c.t.closer = append(c.t.closer, func() error { cancel(); return nil })

		c.dbStatus.Port = localPort
	}
	if c.dbStatus.Password == "" {
		sct, err := c.t.clientset.CoreV1().Secrets(c.t.namespace).Get(context.Background(), "db-password", metav1.GetOptions{})
		if err != nil {
			rerr = err
			return nil
		}
		pwd, ok := sct.Data["mysql-root-password"]
		if !ok {
			rerr = xerrors.Errorf("no mysql-root-password data present in secret %s", sct.Name)
			return nil
		}
		c.dbStatus.Password = string(pwd)
	}

	db, err := sql.Open("mysql", fmt.Sprintf("gitpod:%s@tcp(127.0.0.1:%d)/gitpod", c.dbStatus.Password, c.dbStatus.Port))
	if err != nil {
		rerr = err
		return nil
	}

	c.dbStatus.DB = db
	c.t.closer = append(c.t.closer, db.Close)
	return db
}

// ImageBuilder provides access to the image builder service.
func (c *ComponentAPI) ImageBuilder() imgbldr.ImageBuilderClient {
	if c.imgbldStatus.Client != nil {
		return c.imgbldStatus.Client
	}

	err := func() error {
		if c.imgbldStatus.Port == 0 {
			pod, _, err := c.t.selectPod(ComponentImageBuilder, selectPodOptions{})
			if err != nil {
				return err
			}

			localPort, err := getFreePort()
			if err != nil {
				return err
			}

			ctx, cancel := context.WithCancel(context.Background())
			ready, errc := forwardPort(ctx, c.t.restConfig, c.t.namespace, pod, fmt.Sprintf("%d:8080", localPort))
			select {
			case err = <-errc:
				cancel()
				return err
			case <-ready:
			}
			c.t.closer = append(c.t.closer, func() error { cancel(); return nil })
			c.imgbldStatus.Port = localPort
		}

		conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.imgbldStatus.Port), grpc.WithInsecure())
		if err != nil {
			return err
		}
		c.t.closer = append(c.t.closer, conn.Close)

		c.imgbldStatus.Client = imgbldr.NewImageBuilderClient(conn)
		return nil
	}()
	if err != nil {
		c.t.t.Fatal(err)
		return nil
	}
	return c.imgbldStatus.Client
}
