// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"sigs.k8s.io/e2e-framework/klient"

	// Gitpod uses mysql, so it makes sense to make this DB driver available
	// by default.
	_ "github.com/go-sql-driver/mysql"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration/common"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

var (
	errNoSuitableUser = xerrors.Errorf("no suitable user found: make sure there's at least one non-builtin user in the database (e.g. login)")
)

// API provides access to the individual component's API
func NewComponentAPI(ctx context.Context, namespace string, client klient.Client) *ComponentAPI {
	return &ComponentAPI{
		namespace: namespace,
		client:    client,

		closerMutex: sync.Mutex{},

		wsmanStatusMu:          sync.Mutex{},
		contentServiceStatusMu: sync.Mutex{},
		imgbldStatusMu:         sync.Mutex{},

		serverStatus: &serverStatus{
			Client: make(map[string]*gitpod.APIoverJSONRPC),
			Token:  make(map[string]string),
		},
	}
}

type serverStatus struct {
	Token  map[string]string
	Client map[string]*gitpod.APIoverJSONRPC
}

// ComponentAPI provides access to the individual component's API
type ComponentAPI struct {
	namespace string
	client    klient.Client

	closer      []func() error
	closerMutex sync.Mutex

	serverStatus *serverStatus

	wsmanStatus struct {
		Port   int
		Client wsmanapi.WorkspaceManagerClient
	}
	contentServiceStatus struct {
		Port              int
		BlobServiceClient csapi.BlobServiceClient
		ContentService    ContentService
	}
	imgbldStatus struct {
		Port   int
		Client imgbldr.ImageBuilderClient
	}

	wsmanStatusMu          sync.Mutex
	contentServiceStatusMu sync.Mutex
	imgbldStatusMu         sync.Mutex
}

type DBConfig struct {
	Host        string
	Port        int32
	ForwardPort *ForwardPort
	Password    string
}

type ForwardPort struct {
	PodName    string
	RemotePort int32
}

// Supervisor provides a gRPC connection to a workspace's supervisor
func (c *ComponentAPI) Supervisor(instanceID string) (grpc.ClientConnInterface, error) {
	pod, _, err := selectPod(ComponentWorkspace, selectPodOptions{
		InstanceID: instanceID,
	}, c.namespace, c.client)
	if err != nil {
		return nil, err
	}

	localPort, err := getFreePort()
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	ready, errc := common.ForwardPort(ctx, c.client.RESTConfig(), c.namespace, pod, fmt.Sprintf("%d:22999", localPort))
	select {
	case err = <-errc:
		cancel()
		return nil, err
	case <-ready:
	}
	c.appendCloser(func() error { cancel(); return nil })

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", localPort), grpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	c.appendCloser(conn.Close)
	return conn, nil
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
func (c *ComponentAPI) GitpodServer(opts ...GitpodServerOpt) (gitpod.APIInterface, error) {
	var options gitpodServerOpts
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			return nil, xerrors.Errorf("cannot access Gitpod server API: %q", err)
		}
	}

	if cl, ok := c.serverStatus.Client[options.User]; ok {
		return cl, nil
	}

	var res gitpod.APIInterface
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

		var pods corev1.PodList
		err := c.client.Resources(c.namespace).List(context.Background(), &pods, func(opts *metav1.ListOptions) {
			opts.LabelSelector = "component=server"
		})
		if err != nil {
			return err
		}

		config, err := GetServerConfig(c.namespace, c.client)
		if err != nil {
			return err
		}

		hostURL := config.HostURL
		if hostURL == "" {
			return xerrors.Errorf("server config: empty HostURL")
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
			Log:   log.Log,
		})
		if err != nil {
			return err
		}

		c.serverStatus.Client[options.User] = cl
		res = cl
		c.appendCloser(cl.Close)

		return nil
	}()
	if err != nil {
		return nil, xerrors.Errorf("cannot access Gitpod server API: %q", err)
	}

	return res, nil
}

func (c *ComponentAPI) createGitpodToken(user string) (tkn string, err error) {
	var row *sql.Row

	db, err := c.DB()
	if err != nil {
		return "", err
	}

	if user == "" {
		row = db.QueryRow(`SELECT id FROM d_b_user WHERE NOT id = "` + gitpodBuiltinUserID + `" AND blocked = FALSE AND markedDeleted = FALSE`)
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

	c.appendCloser(func() error {
		_, err := db.Exec("DELETE FROM d_b_gitpod_token WHERE tokenHash = ?", hashVal)
		return err
	})

	return tkn, nil
}

// WorkspaceManager provides access to ws-manager
func (c *ComponentAPI) WorkspaceManager() (wsmanapi.WorkspaceManagerClient, error) {
	if c.wsmanStatus.Client != nil {
		return c.wsmanStatus.Client, nil
	}

	if c.wsmanStatus.Port == 0 {
		c.wsmanStatusMu.Lock()
		defer c.wsmanStatusMu.Unlock()

		pod, _, err := selectPod(ComponentWorkspaceManager, selectPodOptions{}, c.namespace, c.client)
		if err != nil {
			return nil, err
		}

		localPort, err := getFreePort()
		if err != nil {
			return nil, err
		}

		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := common.ForwardPort(ctx, c.client.RESTConfig(), c.namespace, pod, fmt.Sprintf("%d:8080", localPort))
		select {
		case err := <-errc:
			cancel()
			return nil, err
		case <-ready:
		}
		c.appendCloser(func() error { cancel(); return nil })
		c.wsmanStatus.Port = localPort
	}

	secretName := "ws-manager-client-tls"
	ctx, cancel := context.WithCancel(context.Background())

	c.appendCloser(func() error { cancel(); return nil })

	var secret corev1.Secret
	err := c.client.Resources().Get(ctx, secretName, c.namespace, &secret)
	if err != nil {
		return nil, err
	}

	caCrt := secret.Data["ca.crt"]
	tlsCrt := secret.Data["tls.crt"]
	tlsKey := secret.Data["tls.key"]

	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caCrt) {
		return nil, xerrors.Errorf("failed appending CA cert")
	}
	cert, err := tls.X509KeyPair(tlsCrt, tlsKey)
	if err != nil {
		return nil, err
	}
	creds := credentials.NewTLS(&tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      certPool,
		ServerName:   "ws-manager",
	})
	dialOption := grpc.WithTransportCredentials(creds)

	wsport := fmt.Sprintf("localhost:%d", c.wsmanStatus.Port)
	conn, err := grpc.Dial(wsport, dialOption)
	if err != nil {
		return nil, err
	}
	c.appendCloser(conn.Close)

	c.wsmanStatus.Client = wsmanapi.NewWorkspaceManagerClient(conn)
	return c.wsmanStatus.Client, nil
}

// BlobService provides access to the blob service of the content service
func (c *ComponentAPI) BlobService() (csapi.BlobServiceClient, error) {
	if c.contentServiceStatus.BlobServiceClient != nil {
		return c.contentServiceStatus.BlobServiceClient, nil
	}

	if c.contentServiceStatus.Port == 0 {
		c.contentServiceStatusMu.Lock()
		defer c.contentServiceStatusMu.Unlock()

		pod, _, err := selectPod(ComponentContentService, selectPodOptions{}, c.namespace, c.client)
		if err != nil {
			return nil, err
		}

		localPort, err := getFreePort()
		if err != nil {
			return nil, err
		}

		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := common.ForwardPort(ctx, c.client.RESTConfig(), c.namespace, pod, fmt.Sprintf("%d:8080", localPort))
		select {
		case err := <-errc:
			cancel()
			return nil, err
		case <-ready:
		}
		c.appendCloser(func() error { cancel(); return nil })
		c.contentServiceStatus.Port = localPort
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.contentServiceStatus.Port), grpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	c.appendCloser(conn.Close)

	c.contentServiceStatus.BlobServiceClient = csapi.NewBlobServiceClient(conn)
	return c.contentServiceStatus.BlobServiceClient, nil
}

// DB provides access to the Gitpod database.
// Callers must never close the DB.
func (c *ComponentAPI) DB() (*sql.DB, error) {
	config, err := c.findDBConfig()
	if err != nil {
		return nil, err
	}

	// if configured: setup local port-forward to DB pod
	if config.ForwardPort != nil {
		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := common.ForwardPort(ctx, c.client.RESTConfig(), c.namespace, config.ForwardPort.PodName, fmt.Sprintf("%d:%d", config.Port, config.ForwardPort.RemotePort))
		select {
		case err := <-errc:
			cancel()
			return nil, err
		case <-ready:
		}
		c.appendCloser(func() error { cancel(); return nil })
	}

	db, err := sql.Open("mysql", fmt.Sprintf("gitpod:%s@tcp(%s:%d)/gitpod", config.Password, config.Host, config.Port))
	if err != nil {
		return nil, err
	}

	c.appendCloser(db.Close)
	return db, nil
}
func (c *ComponentAPI) findDBConfig() (*DBConfig, error) {
	config, err := FindDBConfigFromPodEnv("server", c.namespace, c.client)
	if err != nil {
		return nil, err
	}

	// here we _assume_ that "config" points to a service: find us a concrete DB pod to forward to
	var svc corev1.Service
	err = c.client.Resources(c.namespace).Get(context.Background(), config.Host, c.namespace, &svc)
	if err != nil {
		return nil, err
	}

	// find remotePort
	var remotePort int32
	for _, p := range svc.Spec.Ports {
		if p.Port == config.Port {
			remotePort = p.TargetPort.IntVal
			if remotePort == 0 {
				remotePort = p.Port
			}
			break
		}
	}
	if remotePort == 0 {
		return nil, xerrors.Errorf("no ports found on service: %s", svc.Name)
	}

	// find pod to forward to
	var pods corev1.PodList
	err = c.client.Resources(c.namespace).List(context.Background(), &pods, func(opts *metav1.ListOptions) {
		opts.LabelSelector = labels.SelectorFromSet(svc.Spec.Selector).String()
	})
	if err != nil {
		return nil, err
	}
	if len(pods.Items) == 0 {
		return nil, xerrors.Errorf("no pods for service %s found", svc.Name)
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
		return nil, xerrors.Errorf("no active pod for service %s found", svc.Name)
	}

	localPort, err := getFreePort()
	if err != nil {
		return nil, err
	}
	config.Port = int32(localPort)
	config.ForwardPort = &ForwardPort{
		RemotePort: remotePort,
		PodName:    pod.Name,
	}
	config.Host = "127.0.0.1"

	return config, nil
}

func FindDBConfigFromPodEnv(componentName string, namespace string, client klient.Client) (*DBConfig, error) {
	lblSelector := fmt.Sprintf("component=%s", componentName)
	var list corev1.PodList
	err := client.Resources(namespace).List(context.Background(), &list, func(opts *metav1.ListOptions) {
		opts.LabelSelector = lblSelector
	})
	if err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, xerrors.Errorf("no pods found for: %s", lblSelector)
	}
	pod := list.Items[0]

	var password, host string
	var port int32
OuterLoop:
	for _, c := range pod.Spec.Containers {
		for _, v := range c.Env {
			var findErr error
			if v.Name == "DB_PASSWORD" {
				password, findErr = FindValueFromEnvVar(v, client, namespace)
				if findErr != nil {
					return nil, findErr
				}
			} else if v.Name == "DB_PORT" {
				var portStr string
				portStr, findErr = FindValueFromEnvVar(v, client, namespace)
				if findErr != nil {
					return nil, findErr
				}
				pPort, err := strconv.ParseUint(portStr, 10, 16)
				if err != nil {
					return nil, xerrors.Errorf("error parsing DB_PORT '%s' on pod %s!", v.Value, pod.Name)
				}
				port = int32(pPort)
			} else if v.Name == "DB_HOST" {
				host, findErr = FindValueFromEnvVar(v, client, namespace)
				if findErr != nil {
					return nil, findErr
				}
			}
			if password != "" && port != 0 && host != "" {
				break OuterLoop
			}
		}
	}
	if password == "" || port == 0 || host == "" {
		return nil, xerrors.Errorf("could not find complete DBConfig on pod %s!", pod.Name)
	}
	config := DBConfig{
		Host:     host,
		Port:     port,
		Password: password,
	}
	return &config, nil
}

func FindValueFromEnvVar(ev corev1.EnvVar, client klient.Client, namespace string) (string, error) {
	// we have a value, just return it
	if ev.Value != "" {
		return ev.Value, nil
	}

	if ev.ValueFrom == nil {
		return "", xerrors.Errorf("Neither Value or ValueFrom exist for %s", ev.Name)
	}

	// value doesn't exist for ENV VARs set by config or secret
	// instead, valueFrom will contain a reference to the backing config or secret
	// secret references look like:
	// '{"name":"DB_PORT","valueFrom":{"secretKeyRef":{"name":"mysql","key":"port"}}}'
	if ev.ValueFrom.SecretKeyRef != nil {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		var secret corev1.Secret
		secretRef := ev.ValueFrom.SecretKeyRef
		err := client.Resources().Get(ctx, secretRef.Name, namespace, &secret)
		if err != nil {
			return "", err
		}

		secretValue := string(secret.Data[secretRef.Key])
		return secretValue, nil
	} else {
		return "", xerrors.Errorf("A secret reference was expected for %s", ev.Name)
	}
}

// APIImageBuilderOpt configures the image builder API access
type APIImageBuilderOpt func(*apiImageBuilderOpts)

type apiImageBuilderOpts struct {
	SelectMK3 bool
}

// ImageBuilder provides access to the image builder service.
func (c *ComponentAPI) ImageBuilder(opts ...APIImageBuilderOpt) (imgbldr.ImageBuilderClient, error) {
	var cfg apiImageBuilderOpts
	for _, o := range opts {
		o(&cfg)
	}

	if c.imgbldStatus.Client != nil {
		return c.imgbldStatus.Client, nil
	}

	err := func() error {
		if c.imgbldStatus.Port == 0 {
			c.imgbldStatusMu.Lock()
			defer c.imgbldStatusMu.Unlock()

			pod, _, err := selectPod(ComponentImageBuilderMK3, selectPodOptions{}, c.namespace, c.client)
			if err != nil {
				return err
			}

			localPort, err := getFreePort()
			if err != nil {
				return err
			}

			ctx, cancel := context.WithCancel(context.Background())
			ready, errc := common.ForwardPort(ctx, c.client.RESTConfig(), c.namespace, pod, fmt.Sprintf("%d:8080", localPort))
			select {
			case err = <-errc:
				cancel()
				return err
			case <-ready:
			}
			c.appendCloser(func() error { cancel(); return nil })
			c.imgbldStatus.Port = localPort
		}

		conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.imgbldStatus.Port), grpc.WithInsecure())
		if err != nil {
			return err
		}
		c.appendCloser(conn.Close)

		c.imgbldStatus.Client = imgbldr.NewImageBuilderClient(conn)
		return nil
	}()
	if err != nil {
		return nil, err
	}

	return c.imgbldStatus.Client, nil
}

// ContentService groups content service interfaces for convenience
type ContentService interface {
	csapi.ContentServiceClient
	csapi.WorkspaceServiceClient
}

func (c *ComponentAPI) ContentService() (ContentService, error) {
	if c.contentServiceStatus.ContentService != nil {
		return c.contentServiceStatus.ContentService, nil
	}
	if c.contentServiceStatus.Port == 0 {
		pod, _, err := selectPod(ComponentContentService, selectPodOptions{}, c.namespace, c.client)
		if err != nil {
			return nil, err
		}

		localPort, err := getFreePort()
		if err != nil {
			return nil, err
		}

		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := common.ForwardPort(ctx, c.client.RESTConfig(), c.namespace, pod, fmt.Sprintf("%d:8080", localPort))
		select {
		case err := <-errc:
			cancel()
			return nil, err
		case <-ready:
		}
		c.appendCloser(func() error { cancel(); return nil })
		c.contentServiceStatus.Port = localPort
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.contentServiceStatus.Port), grpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	c.appendCloser(conn.Close)

	type cs struct {
		csapi.ContentServiceClient
		csapi.WorkspaceServiceClient
	}

	c.contentServiceStatus.ContentService = cs{
		ContentServiceClient:   csapi.NewContentServiceClient(conn),
		WorkspaceServiceClient: csapi.NewWorkspaceServiceClient(conn),
	}

	return c.contentServiceStatus.ContentService, nil
}

func (c *ComponentAPI) Done(t *testing.T) {
	// Much "defer", we run the closer in reversed order. This way, we can
	// append to this list quite naturally, and still break things down in
	// the correct order.
	for i := len(c.closer) - 1; i >= 0; i-- {
		err := c.closer[i]()
		if err != nil {
			t.Logf("cleanup failed: %q", err)
		}
	}
}

func (c *ComponentAPI) appendCloser(closer func() error) {
	c.closerMutex.Lock()
	defer c.closerMutex.Unlock()
	c.closer = append(c.closer, closer)
}
