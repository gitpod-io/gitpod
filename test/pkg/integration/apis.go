// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/e2e-framework/klient"
	"sigs.k8s.io/e2e-framework/klient/k8s"

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

// API provides access to the individual component's API
func NewComponentAPI(ctx context.Context, namespace string, kubeconfig string, client klient.Client) *ComponentAPI {
	return &ComponentAPI{
		namespace:  namespace,
		kubeconfig: kubeconfig,
		client:     client,

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
	namespace  string
	kubeconfig string
	client     klient.Client

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

type EncryptionKeyMetadata struct {
	Name    string
	Version int
}

type EncryptionKey struct {
	Metadata EncryptionKeyMetadata
	Material []byte
}

type DBConfig struct {
	Host           string
	Port           int32
	ForwardPort    *ForwardPort
	Password       string
	EncryptionKeys EncryptionKey
}

type ForwardPort struct {
	PodName    string
	RemotePort int32
}

type EncriptedDBData struct {
	Data      string `json:"data"`
	KeyParams struct {
		Iv string `json:"iv"`
	} `json:"keyParams"`
	KeyMetadata struct {
		Name    string `json:"name"`
		Version int    `json:"version"`
	} `json:"keyMetadata"`
}

func EncryptValue(value []byte, key []byte) (data string, iv string) {
	PKCS5Padding := func(ciphertext []byte, blockSize int, after int) []byte {
		padding := (blockSize - len(ciphertext)%blockSize)
		padtext := bytes.Repeat([]byte{byte(padding)}, padding)
		return append(ciphertext, padtext...)
	}

	ivData := []byte("1234567890123456")

	block, _ := aes.NewCipher(key)
	mode := cipher.NewCBCEncrypter(block, ivData)

	paddedValue := PKCS5Padding(value, aes.BlockSize, len(value))
	ciphertext := make([]byte, len(paddedValue))
	mode.CryptBlocks(ciphertext, paddedValue)

	data = base64.StdEncoding.EncodeToString(ciphertext)
	iv = base64.StdEncoding.EncodeToString(ivData)

	return
}

// Storage provides a url of the storage provider
// it takes a url as input and creates a port forward if required
// e.g. when minio running in gitpod cluster
// and modifies the url to refer to the localhost instead of dns name
func (c *ComponentAPI) Storage(connUrl string) (string, error) {
	u, err := url.Parse(connUrl)
	if err != nil {
		return "", err
	}
	host, port, _ := net.SplitHostPort(u.Host)
	if !strings.HasSuffix(host, ".svc.cluster.local") {
		return connUrl, nil
	}
	serviceName := strings.Split(host, ".")[0]

	localPort, err := getFreePort()
	if err != nil {
		return "", err
	}

	targetPort, err := strconv.Atoi(port)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	err = c.portFwdWithRetry(ctx, common.ForwardPortOfSvc, serviceName, localPort, targetPort)
	if err != nil {
		cancel()
		return "", err
	}

	c.appendCloser(func() error { cancel(); return nil })

	return strings.Replace(connUrl, u.Host, fmt.Sprintf("localhost:%d", localPort), 1), nil
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	err = c.portFwdWithRetry(ctx, common.ForwardPortOfPod, pod, localPort, 8080)
	if err != nil {
		cancel()
		return nil, err
	}
	c.appendCloser(func() error { cancel(); return nil })

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", localPort), grpc.WithTransportCredentials(insecure.NewCredentials()))
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

func (c *ComponentAPI) CreateOAuth2Token(user string, scopes []string) (string, error) {
	tkn, err := c.createGitpodToken(user, scopes)
	if err != nil {
		return "", err
	}
	return tkn, nil
}

func (c *ComponentAPI) ClearGitpodServerClientCache() {
	c.serverStatus.Client = map[string]*gitpod.APIoverJSONRPC{}
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
			tkn, err = c.createGitpodToken(options.User, []string{
				"resource:default",
				"function:*",
			})
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

func (c *ComponentAPI) GetServerEndpoint() (string, error) {
	config, err := GetServerConfig(c.namespace, c.client)
	if err != nil {
		return "", err
	}

	hostURL := config.HostURL
	if hostURL == "" {
		return "", xerrors.Errorf("server config: empty HostURL")
	}

	endpoint, err := url.Parse(hostURL)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s://%s/", "https", endpoint.Hostname()), nil
}

func (c *ComponentAPI) GitpodSessionCookie(userId string, secretKey string) (*http.Cookie, error) {
	var res *http.Cookie
	err := func() error {
		config, err := GetServerConfig(c.namespace, c.client)
		if err != nil {
			return err
		}

		hostURL := config.HostURL
		if hostURL == "" {
			return xerrors.Errorf("server config: empty HostURL")
		}

		endpoint, err := url.Parse(hostURL)
		if err != nil {
			return err
		}

		origin := fmt.Sprintf("%s://%s/", "https", endpoint.Hostname())

		client := &http.Client{
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}

		req, _ := http.NewRequest("GET", hostURL+fmt.Sprintf("/api/login/ots/%s/%s", userId, secretKey), nil)
		req.Header.Set("Origin", origin)
		req.Header.Set("Cache-Control", "no-store")

		httpresp, err := client.Do(req)
		if err != nil {
			return err
		}

		cookies := httpresp.Cookies()
		if len(cookies) > 0 {
			res = cookies[0]
		}

		return nil
	}()
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, xerrors.Errorf("Server did not provide a session cookie")
	}

	return res, nil
}

func (c *ComponentAPI) GetUserId(user string) (userId string, err error) {
	db, err := c.DB()
	if err != nil {
		return "", err
	}

	var row *sql.Row
	if user == "" {
		row = db.QueryRow(`SELECT id FROM d_b_user WHERE NOT id = "` + gitpodBuiltinUserID + `" AND blocked = FALSE AND markedDeleted = FALSE`)
	} else {
		row = db.QueryRow("SELECT id FROM d_b_user WHERE name = ?", user)
	}

	var id string
	err = row.Scan(&id)
	if err == sql.ErrNoRows {
		return "", xerrors.Errorf("no suitable user found: make sure there's at least one non-builtin user in the database (e.g. login)")
	}
	if err != nil {
		return "", xerrors.Errorf("cannot look for users: %w", err)
	}

	return id, nil
}

func (c *ComponentAPI) UpdateUserFeatureFlag(userId, featureFlag string) error {
	db, err := c.DB()
	if err != nil {
		return err
	}

	if _, err = db.Exec("SELECT id FROM d_b_user WHERE id = ?", userId); err != nil {
		return err
	}

	if _, err = db.Exec("UPDATE d_b_user SET featureFlags=? WHERE id = ?", fmt.Sprintf("{\"permanentWSFeatureFlags\":[%q]}", featureFlag), userId); err != nil {
		return err
	}
	return nil
}

func (c *ComponentAPI) CreateUser(username string, token string) (string, error) {
	dbConfig, err := FindDBConfigFromPodEnv("server", c.namespace, c.client)
	if err != nil {
		return "", err
	}

	db, err := c.DB()
	if err != nil {
		return "", err
	}

	var userId string
	err = db.QueryRow(`SELECT id FROM d_b_user WHERE name = ?`, username).Scan(&userId)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	if userId == "" {
		userUuid, err := uuid.NewRandom()
		if err != nil {
			return "", err
		}

		userId = userUuid.String()
		_, err = db.Exec(`INSERT IGNORE INTO d_b_user (id, creationDate, avatarUrl, name, fullName, featureFlags) VALUES (?, ?, ?, ?, ?, ?)`,
			userId,
			time.Now().Format(time.RFC3339),
			"",
			username,
			username,
			"{\"permanentWSFeatureFlags\":[]}",
		)
		if err != nil {
			return "", err
		}
	}

	var authId string
	err = db.QueryRow(`SELECT authId FROM d_b_identity WHERE userId = ?`, userId).Scan(&authId)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if authId == "" {
		authId = strconv.FormatInt(time.Now().UnixMilli(), 10)
		_, err = db.Exec(`INSERT IGNORE INTO d_b_identity (authProviderId, authId, authName, userId, tokens) VALUES (?, ?, ?, ?, ?)`,
			"Public-GitHub",
			authId,
			username,
			userId,
			"[]",
		)
		if err != nil {
			return "", err
		}
	}

	var cnt int
	err = db.QueryRow(`SELECT COUNT(1) AS cnt FROM d_b_token_entry WHERE authId = ?`, authId).Scan(&cnt)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if cnt == 0 {
		uid, err := uuid.NewRandom()
		if err != nil {
			return "", err
		}

		// Double Marshalling to be compatible with EncryptionServiceImpl
		value := struct {
			Value  string   `json:"value"`
			Scopes []string `json:"scopes"`
		}{
			Value:  token,
			Scopes: []string{"user:email", "read:user", "public_repo"},
		}
		valueBytes, err := json.Marshal(value)
		if err != nil {
			return "", err
		}
		valueBytes2, err := json.Marshal(string(valueBytes))
		if err != nil {
			return "", err
		}

		encryptedData, iv := EncryptValue(valueBytes2, dbConfig.EncryptionKeys.Material)
		encrypted := EncriptedDBData{}
		encrypted.Data = encryptedData
		encrypted.KeyParams.Iv = iv
		encrypted.KeyMetadata.Name = dbConfig.EncryptionKeys.Metadata.Name
		encrypted.KeyMetadata.Version = dbConfig.EncryptionKeys.Metadata.Version
		encryptedJson, err := json.Marshal(encrypted)
		if err != nil {
			return "", err
		}

		_, err = db.Exec(`INSERT IGNORE INTO d_b_token_entry (authProviderId, authId, token, uid) VALUES (?, ?, ?, ?)`,
			"Public-GitHub",
			authId,
			encryptedJson,
			uid.String(),
		)
		if err != nil {
			return "", err
		}
	}

	return userId, nil
}

func (c *ComponentAPI) MakeUserUnleashedPlan(username string) error {
	db, err := c.DB()
	if err != nil {
		return err
	}
	defer db.Close()

	var userId string
	err = db.QueryRow(`SELECT id FROM d_b_user WHERE name = ?`, username).Scan(&userId)
	if err != nil {
		return err
	}

	var subId string
	err = db.QueryRow(`SELECT uid FROM d_b_subscription WHERE userId = ? and planId = ?`, username, "professional-eur").Scan(&subId)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if subId != "" {
		return nil
	}

	// reset all of this user subscription
	_, err = db.Exec(`DELETE from d_b_subscription WHERE userId = ?`, userId)
	if err != nil {
		return err
	}

	uid, err := uuid.NewRandom()
	if err != nil {
		return err
	}

	_, err = db.Exec(`INSERT INTO d_b_subscription (uid, userId, startDate, amount, planId) VALUES (?, ?, ?, ?, ?)`,
		uid,
		userId,
		"2022-10-19T00:00:00.000Z",
		11904,
		"professional-eur",
	)
	if err != nil {
		return err
	}

	return nil
}

func (c *ComponentAPI) createGitpodToken(user string, scopes []string) (tkn string, err error) {
	id, err := c.GetUserId(user)
	if err != nil {
		return "", err
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

	db, err := c.DB()
	if err != nil {
		return "", err
	}
	_, err = db.Exec("INSERT INTO d_b_gitpod_token (tokenHash, name, type, userId, scopes, created) VALUES (?, ?, ?, ?, ?, ?)",
		hashVal,
		fmt.Sprintf("integration-test-%d", time.Now().UnixNano()),
		tokenTypeMachineAuthToken,
		id,
		strings.Join(scopes, ","),
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

func (c *ComponentAPI) CreateGitpodOneTimeSecret(value string) (id string, err error) {
	dbConfig, err := FindDBConfigFromPodEnv("server", c.namespace, c.client)
	if err != nil {
		return "", err
	}

	db, err := c.DB()
	if err != nil {
		return "", err
	}

	rawUuid, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	id = rawUuid.String()

	// Double Marshalling to be compatible with EncryptionServiceImpl
	valueBytes, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	valueBytes2, err := json.Marshal(string(valueBytes))
	if err != nil {
		return "", err
	}

	encryptedData, iv := EncryptValue(valueBytes2, dbConfig.EncryptionKeys.Material)
	encrypted := EncriptedDBData{}
	encrypted.Data = encryptedData
	encrypted.KeyParams.Iv = iv
	encrypted.KeyMetadata.Name = dbConfig.EncryptionKeys.Metadata.Name
	encrypted.KeyMetadata.Version = dbConfig.EncryptionKeys.Metadata.Version
	encryptedJson, err := json.Marshal(encrypted)
	if err != nil {
		return "", err
	}

	_, err = db.Exec("INSERT INTO d_b_one_time_secret (id, value, expirationTime, deleted) VALUES (?, ?, ?, ?)",
		id,
		string(encryptedJson),
		time.Now().Add(30*time.Minute).UTC().Format("2006-01-02 15:04:05.999999"),
		false,
	)
	if err != nil {
		return "", err
	}

	c.appendCloser(func() error {
		_, err := db.Exec("DELETE FROM d_b_one_time_secret WHERE id = ?", id)
		return err
	})

	return id, nil
}

// WorkspaceManager provides access to ws-manager
func (c *ComponentAPI) WorkspaceManager() (wsmanapi.WorkspaceManagerClient, error) {
	if c.wsmanStatus.Client != nil {
		return c.wsmanStatus.Client, nil
	}

	var wsman = ComponentWorkspaceManager
	if UseWsmanMk2() {
		wsman = ComponentWorkspaceManagerMK2
	}

	if c.wsmanStatus.Port == 0 {
		c.wsmanStatusMu.Lock()
		defer c.wsmanStatusMu.Unlock()

		pod, _, err := selectPod(wsman, selectPodOptions{}, c.namespace, c.client)
		if err != nil {
			return nil, err
		}

		localPort, err := getFreePort()
		if err != nil {
			return nil, err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		err = c.portFwdWithRetry(ctx, common.ForwardPortOfPod, pod, localPort, 8080)
		if err != nil {
			cancel()
			return nil, err
		}

		c.appendCloser(func() error { cancel(); return nil })
		c.wsmanStatus.Port = localPort
	}

	secretName := fmt.Sprintf("%s-client-tls", wsman)
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
		ServerName:   string(wsman),
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

func (c *ComponentAPI) ClearWorkspaceManagerClientCache() {
	c.wsmanStatus.Client = nil
	c.wsmanStatus.Port = 0
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

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		err = c.portFwdWithRetry(ctx, common.ForwardPortOfPod, pod, localPort, 8080)
		if err != nil {
			cancel()
			return nil, err
		}
		c.appendCloser(func() error { cancel(); return nil })
		c.contentServiceStatus.Port = localPort
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.contentServiceStatus.Port), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	c.appendCloser(conn.Close)

	c.contentServiceStatus.BlobServiceClient = csapi.NewBlobServiceClient(conn)
	return c.contentServiceStatus.BlobServiceClient, nil
}

func (c *ComponentAPI) ClearBlobServiceClientCache() {
	c.contentServiceStatus.BlobServiceClient = nil
	c.contentServiceStatus.Port = 0
}

type dbOpts struct {
	Database string
}

// DNOpt configures DB access
type DBOpt func(*dbOpts)

// DBName forces a particular database
func DBName(name string) DBOpt {
	return func(o *dbOpts) {
		o.Database = name
	}
}

// DB provides access to the Gitpod database.
// Callers must never close the DB.
func (c *ComponentAPI) DB(options ...DBOpt) (*sql.DB, error) {
	opts := dbOpts{
		Database: "gitpod",
	}
	for _, o := range options {
		o(&opts)
	}

	config, err := c.findDBConfig()
	if err != nil {
		return nil, err
	}

	// if configured: setup local port-forward to DB pod
	if config.ForwardPort != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		err = c.portFwdWithRetry(ctx, common.ForwardPortOfPod, config.ForwardPort.PodName, int(config.Port), int(config.ForwardPort.RemotePort))
		if err != nil {
			cancel()
			return nil, err
		}
		c.appendCloser(func() error { cancel(); return nil })
	}

	db, err := sql.Open("mysql", fmt.Sprintf("gitpod:%s@tcp(%s:%d)/%s", config.Password, config.Host, config.Port, opts.Database))
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
	var dbEncryptionKeys *EncryptionKey
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
			} else if v.Name == "DB_ENCRYPTION_KEYS" {
				raw, findErr := FindValueFromEnvVar(v, client, namespace)
				if findErr != nil {
					return nil, findErr
				}

				var k []struct {
					Name     string `json:"name"`
					Version  int    `json:"version"`
					Material []byte `json:"material"`
				}
				err = json.Unmarshal([]byte(raw), &k)
				if err != nil {
					return nil, err
				}
				if len(k) > 0 {
					dbEncryptionKeys = &EncryptionKey{
						Metadata: EncryptionKeyMetadata{
							Name:    k[0].Name,
							Version: k[0].Version,
						},
						Material: k[0].Material,
					}
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
			if password != "" && port != 0 && host != "" && dbEncryptionKeys != nil {
				break OuterLoop
			}
		}
	}
	if password == "" || port == 0 || host == "" || dbEncryptionKeys == nil {
		return nil, xerrors.Errorf("could not find complete DBConfig on pod %s!", pod.Name)
	}
	config := DBConfig{
		Host:           host,
		Port:           port,
		Password:       password,
		EncryptionKeys: *dbEncryptionKeys,
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

	imgbuilder := ComponentImageBuilderMK3
	if UseWsmanMk2() {
		imgbuilder = ComponentImageBuilderMK3Wsman
	}

	err := func() error {
		if c.imgbldStatus.Port == 0 {
			c.imgbldStatusMu.Lock()
			defer c.imgbldStatusMu.Unlock()

			pod, _, err := selectPod(imgbuilder, selectPodOptions{}, c.namespace, c.client)
			if err != nil {
				return err
			}

			localPort, err := getFreePort()
			if err != nil {
				return err
			}

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			err = c.portFwdWithRetry(ctx, common.ForwardPortOfPod, pod, localPort, 8080)
			if err != nil {
				cancel()
				return err
			}
			c.appendCloser(func() error { cancel(); return nil })
			c.imgbldStatus.Port = localPort
		}

		conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.imgbldStatus.Port), grpc.WithTransportCredentials(insecure.NewCredentials()))
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

func (c *ComponentAPI) ClearImageBuilderClientCache() {
	c.imgbldStatus.Client = nil
	c.imgbldStatus.Port = 0
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
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		err = c.portFwdWithRetry(ctx, common.ForwardPortOfPod, pod, localPort, 8080)
		if err != nil {
			cancel()
			return nil, err
		}
		c.appendCloser(func() error { cancel(); return nil })
		c.contentServiceStatus.Port = localPort
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", c.contentServiceStatus.Port), grpc.WithTransportCredentials(insecure.NewCredentials()))
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

func (c *ComponentAPI) ClearContentServiceClientCache() {
	c.contentServiceStatus.ContentService = nil
	c.contentServiceStatus.Port = 0
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

type portFwdFunc = func(ctx context.Context, kubeconfig string, namespace, name, port string) (chan struct{}, chan error)

func (c *ComponentAPI) portFwdWithRetry(ctx context.Context, portFwdF portFwdFunc, serviceName string, localPort int, targetPort int) error {
	for {
		ready, errc := portFwdF(ctx, c.kubeconfig, c.namespace, serviceName, fmt.Sprintf("%d:%d", localPort, targetPort))
		select {
		case err := <-errc:
			if err == io.EOF {
				time.Sleep(10 * time.Second)
			} else if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
				time.Sleep(10 * time.Second)
			} else {
				return err
			}
		case <-ready:
			return nil
		}
	}
}

func (c *ComponentAPI) IsPVCExist(pvcName string) bool {
	var pvc corev1.PersistentVolumeClaim
	return c.client.Resources().Get(context.Background(), pvcName, c.namespace, &pvc) == nil
}

// RestartDeployment rollout restart the deployment by updating the
// spec.template.metadata.annotations["kubectl.kubernetes.io/restartedAt"] = time.Now()
func (c *ComponentAPI) RestartDeployment(deployName, namespace string, wait bool) error {
	var deploy appsv1.Deployment
	if err := c.client.Resources().WithNamespace(namespace).Get(context.Background(), deployName, namespace, &deploy); err != nil {
		return err
	}

	patchData := map[string]interface{}{
		"spec": map[string]interface{}{
			"template": map[string]interface{}{
				"metadata": map[string]interface{}{
					"annotations": map[string]interface{}{
						"kubectl.kubernetes.io/restartedAt": time.Now().Format(time.Stamp),
					},
				},
			},
		},
	}

	encodedPatchData, err := json.Marshal(patchData)
	if err != nil {
		return err
	}

	if err := c.client.Resources().WithNamespace(namespace).Patch(context.Background(), &deploy, k8s.Patch{PatchType: types.MergePatchType, Data: encodedPatchData}); err != nil {
		return err
	}

	if !wait {
		return nil
	}

	// waits for the deployment rollout status, maximum to one minute
	for i := 0; i < 10; i++ {
		if err := c.client.Resources().WithNamespace(namespace).Get(context.Background(), deployName, namespace, &deploy); err != nil {
			return err
		}
		if deploy.Status.UnavailableReplicas == 0 {
			break
		}
		time.Sleep(6 * time.Second)
	}
	return nil
}
