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
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"

	// Gitpod uses mysql, so it makes sense to make this DB driver available
	// by default.
	_ "github.com/go-sql-driver/mysql"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	imgbldr "github.com/gitpod-io/gitpod/image-builder/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

var (
	errNoSuitableUser = xerrors.Errorf("no suitable user found: make sure there's at least one non-builtin user in the database (e.g. login)")
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
		ContentService    ContentService
	}
	dbStatus struct {
		Config *DBConfig
		DB     *sql.DB
	}
	imgbldStatus struct {
		Port   int
		Client imgbldr.ImageBuilderClient
	}
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

		cfg, err := c.t.GetServerConfig()
		if err != nil {
			return err
		}
		hostURL := cfg.HostURL
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

	secretName := "ws-manager-client-tls"
	ctx, cancel := context.WithCancel(context.Background())
	secret, err := c.t.clientset.CoreV1().Secrets(c.t.namespace).Get(ctx, secretName, metav1.GetOptions{})
	if err != nil {
		log.Fatal(err)
	}
	cancel()
	caCrt := secret.Data["ca.crt"]
	tlsCrt := secret.Data["tls.crt"]
	tlsKey := secret.Data["tls.key"]

	log.Debug("using TLS config to connect ws-manager")
	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caCrt) {
		rerr = xerrors.Errorf("failed appending CA cert")
		return nil
	}
	cert, err := tls.X509KeyPair(tlsCrt, tlsKey)
	if err != nil {
		rerr = err
		return nil
	}
	creds := credentials.NewTLS(&tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      certPool,
		ServerName:   "ws-manager",
	})
	dialOption := grpc.WithTransportCredentials(creds)

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.wsmanStatus.Port), dialOption)
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

	if c.dbStatus.Config == nil {
		config, err := c.findDBConfig()
		if err != nil {
			rerr = err
			return nil
		}
		c.dbStatus.Config = config
	}
	config := c.dbStatus.Config

	// if configured: setup local port-forward to DB pod
	if config.ForwardPort != nil {
		ctx, cancel := context.WithCancel(context.Background())
		ready, errc := forwardPort(ctx, c.t.restConfig, c.t.namespace, config.ForwardPort.PodName, fmt.Sprintf("%d:%d", config.Port, config.ForwardPort.RemotePort))
		select {
		case err := <-errc:
			cancel()
			rerr = err
			return nil
		case <-ready:
		}
		c.t.closer = append(c.t.closer, func() error { cancel(); return nil })
	}

	db, err := sql.Open("mysql", fmt.Sprintf("gitpod:%s@tcp(%s:%d)/gitpod", config.Password, config.Host, config.Port))
	if err != nil {
		rerr = err
		return nil
	}

	c.dbStatus.DB = db
	c.t.closer = append(c.t.closer, db.Close)
	return db
}

func (c *ComponentAPI) findDBConfig() (*DBConfig, error) {
	config, err := c.findDBConfigFromPodEnv("server")
	if err != nil {
		return nil, err
	}

	// here we _assume_ that "config" points to a service: find us a concrete DB pod to forward to
	svc, err := c.t.clientset.CoreV1().Services(c.t.namespace).Get(context.Background(), config.Host, metav1.GetOptions{})
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
	pods, err := c.t.clientset.CoreV1().Pods(c.t.namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: labels.SelectorFromSet(svc.Spec.Selector).String(),
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

func (c *ComponentAPI) findDBConfigFromPodEnv(componentName string) (*DBConfig, error) {
	lblSelector := fmt.Sprintf("component=%s", componentName)
	list, err := c.t.clientset.CoreV1().Pods(c.t.namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: lblSelector,
	})
	if err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, xerrors.Errorf("no pods found for: %s", lblSelector)
	}
	pod := list.Items[0]

	var password string
	var port int32
	var host string
OuterLoop:
	for _, c := range pod.Spec.Containers {
		for _, v := range c.Env {
			if v.Name == "DB_PASSWORD" {
				password = v.Value
			} else if v.Name == "DB_PORT" {
				pPort, err := strconv.ParseUint(v.Value, 10, 16)
				if err != nil {
					return nil, xerrors.Errorf("error parsing DB_PORT '%s' on pod %s!", v.Value, pod.Name)
				}
				port = int32(pPort)
			} else if v.Name == "DB_HOST" {
				host = v.Value
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

// APIImageBuilderOpt configures the image builder API access
type APIImageBuilderOpt func(*apiImageBuilderOpts)

// SelectImageBuilderMK3 selects the image builder mk3
func SelectImageBuilderMK3(o *apiImageBuilderOpts) {
	o.SelectMK3 = true
}

type apiImageBuilderOpts struct {
	SelectMK3 bool
}

// ImageBuilder provides access to the image builder service.
func (c *ComponentAPI) ImageBuilder(opts ...APIImageBuilderOpt) imgbldr.ImageBuilderClient {
	var cfg apiImageBuilderOpts
	for _, o := range opts {
		o(&cfg)
	}

	if c.imgbldStatus.Client != nil {
		return c.imgbldStatus.Client
	}

	err := func() error {
		if c.imgbldStatus.Port == 0 {
			cmp := ComponentImageBuilder
			if cfg.SelectMK3 {
				cmp = ComponentImageBuilderMK3
			}
			pod, _, err := c.t.selectPod(cmp, selectPodOptions{})
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

// ContentService groups content service interfaces for convenience
type ContentService interface {
	csapi.ContentServiceClient
	csapi.WorkspaceServiceClient
}

func (c *ComponentAPI) ContentService() ContentService {
	var rerr error
	defer func() {
		if rerr == nil {
			return
		}

		c.t.t.Fatalf("cannot access blob service: %q", rerr)
	}()

	if c.contentServiceStatus.ContentService != nil {
		return c.contentServiceStatus.ContentService
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

	type cs struct {
		csapi.ContentServiceClient
		csapi.WorkspaceServiceClient
	}

	c.contentServiceStatus.ContentService = cs{
		ContentServiceClient:   csapi.NewContentServiceClient(conn),
		WorkspaceServiceClient: csapi.NewWorkspaceServiceClient(conn),
	}
	return c.contentServiceStatus.ContentService
}
