// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"github.com/cockroachdb/errors"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	clog "github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
)

type Status struct {
	Name   string
	Active bool
	Reason string
}

var (
	errDBPasswordNotFound = errors.New("db password not found")
	errPortForwardTimeout = errors.New("timed out waiting for port forward")
)

func (c *Config) GetStatus(ctx context.Context) (Status, error) {
	logEntry := c.logger.WithFields(log.Fields{
		"preview": c.name,
	})

	// If the VM got created in the last 120 mins, always assume it's active
	// clock skew can go to hell
	c.ensureVMICreationTime()
	if c.vmiCreationTime.After(time.Now().Add(-120 * time.Minute)) {
		logEntry.WithFields(log.Fields{
			"created": c.vmiCreationTime,
		}).Debug("VM created in the past 20 mins, assuming active")

		c.status.Active = true
		c.status.Reason = fmt.Sprintf("VM created in the past 20 mins, assuming active: [%v]", c.vmiCreationTime.Time)
		return c.status, nil
	}

	return c.getDBStatus(ctx)
}

func (c *Config) getDBStatus(ctx context.Context) (Status, error) {
	secret, err := c.previewClient.CoreClient.CoreV1().Secrets(metav1.NamespaceDefault).Get(ctx, "db-password", metav1.GetOptions{})
	if err != nil {
		c.status.Reason = errors.Wrap(err, errDBPasswordNotFound.Error()).Error()
		return c.status, nil
	}

	dbPwd, ok := secret.Data["mysql-root-password"]
	if !ok {
		c.status.Reason = errors.Wrap(err, errDBPasswordNotFound.Error()).Error()
		return c.status, nil
	}

	stopChan, readyChan, errChan := make(chan struct{}), make(chan struct{}, 1), make(chan error)

	// pick a random port, so we avoid clashes if something else port-forwards to 2200
	randPort := strconv.Itoa(rand.Intn(33999-30307) + 30307)

	go func() {
		err = c.previewClient.PortForward(ctx, k8s.PortForwardOpts{
			Name:      "mysql-0",
			Namespace: metav1.NamespaceDefault,
			Ports: []string{
				fmt.Sprintf("%s:3306", randPort),
			},
			ReadyChan: readyChan,
			StopChan:  stopChan,
			ErrChan:   errChan,
		})

		if err != nil {
			errChan <- err
			return
		}
	}()

	select {
	case <-readyChan:
		return c.dbStatus(ctx, string(dbPwd), randPort)
	case err := <-errChan:
		c.status.Reason = err.Error()
		return c.status, err
	case <-time.After(time.Second * 30):
		c.status.Reason = errPortForwardTimeout.Error()
		return c.status, errPortForwardTimeout
	case <-ctx.Done():
		c.logger.Debug("context cancelled")
		c.status.Reason = ctx.Err().Error()
		return c.status, ctx.Err()
	}
}

func (c *Config) dbStatus(ctx context.Context, password, port string) (Status, error) {
	conn, err := db.Connect(db.ConnectionParams{
		User:     "root",
		Password: password,
		Host:     fmt.Sprintf("127.0.0.1:%s", port),
		Database: "gitpod",
	})
	if err != nil {
		c.status.Reason = errors.Wrap(err, "error conencting to mysql").Error()
		return c.status, err
	}

	// sets the logger that is used in the db lib to Warn
	clog.Log.Logger.SetLevel(3)

	queries := []string{
		"SELECT TIMESTAMPDIFF(HOUR, creationTime, NOW()) as timediff FROM d_b_workspace_instance WHERE creationTime > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY creationTime DESC LIMIT 1",
		"SELECT TIMESTAMPDIFF(HOUR, creationTime, NOW()) as timediff FROM d_b_workspace_instance WHERE creationTime > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY creationTime DESC LIMIT 1",
		"SELECT TIMESTAMPDIFF(HOUR, _lastModified, NOW()) as timediff FROM d_b_user WHERE _lastModified > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY _lastModified DESC LIMIT 1",
		"SELECT TIMESTAMPDIFF(HOUR, lastSeen, NOW()) as timediff FROM d_b_workspace_instance_user WHERE lastSeen > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY lastSeen DESC LIMIT 1",
	}

	for _, q := range queries {
		res := map[string]interface{}{}

		r := conn.WithContext(ctx).Raw(q).Take(&res)

		if r.Error != nil {
			if errors.Is(r.Error, gorm.ErrRecordNotFound) {
				c.status.Reason = "last activity older than 48h"
				continue
			}

			c.status.Reason = err.Error()
			return c.status, err
		}

		if r.RowsAffected > 0 {
			c.logger.WithFields(log.Fields{
				"preview":  c.name,
				"created":  c.vmiCreationTime,
				"query":    q,
				"activity": fmt.Sprintf("%v hours ago", res["timediff"]),
			}).Debug("db has activity")

			c.status.Active = true
			c.status.Reason = fmt.Sprintf("last activity %v hours ago", res["timediff"])
			return c.status, nil
		}
	}

	return c.status, nil
}
