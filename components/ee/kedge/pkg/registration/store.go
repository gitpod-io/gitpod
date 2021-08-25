// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package registration

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/util/retry"
)

// ErrAlreadyExists is returned by Add if the collector exists already
var ErrAlreadyExists = errors.New("already exists")

// Store can store incoming registrations and retrieve them
type Store interface {
	// Add stores a collector in this store - if a collector of the same name is already in the store,
	// this function will return ErrAlreadyExists
	Add(kedge.Collector) error

	// List retrieves all collectors stored in this store
	List() ([]kedge.Collector, error)

	// Remove deletes a collector from this store
	Remove(name string) error
}

// EmptyStore cannot store anything and always returns an empty list
type EmptyStore struct{}

// Add stores a collector in this store
func (EmptyStore) Add(kedge.Collector) error {
	return errors.New("not implemented")
}

// List retrieves all collectors stored in this store
func (EmptyStore) List() ([]kedge.Collector, error) {
	return nil, nil
}

// Remove deletes a collector from this store
func (EmptyStore) Remove(name string) error {
	return errors.New("not implemented")
}

// KubernetesStore stores collectors in Kubernetes secrets
type KubernetesStore struct {
	Clientset kubernetes.Interface
	Namespace string
	Secret    string
}

// NewKubernetesStore creates a new kubernetes store by creating the required Kubernetes resources
func NewKubernetesStore(clientset kubernetes.Interface, namespace, secretName string) (*KubernetesStore, error) {
	api := clientset.CoreV1().Secrets(namespace)
	_, err := api.Get(context.Background(), secretName, metav1.GetOptions{})
	if serr, ok := err.(*k8serr.StatusError); ok && serr.ErrStatus.Code == http.StatusNotFound {
		// map doesn't exist yet - create it
		_, err = api.Create(context.Background(), &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: namespace,
				Labels: map[string]string{
					kedge.LabelKedge: "true",
				},
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return nil, xerrors.Errorf("cannot create storage secret: %w", err)
		}
	}

	return &KubernetesStore{
		Clientset: clientset,
		Namespace: namespace,
		Secret:    secretName,
	}, nil
}

// Add stores a collector in this store
func (ks *KubernetesStore) Add(c kedge.Collector) error {
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}

	api := ks.Clientset.CoreV1().Secrets(ks.Namespace)
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		obj, err := api.Get(context.Background(), ks.Secret, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if obj.Data == nil {
			obj.Data = make(map[string][]byte)
		}

		if _, exists := obj.Data[c.Name]; exists {
			return xerrors.Errorf("%s: %w", c.Name, ErrAlreadyExists)
		}

		obj.Data[c.Name] = data
		_, err = api.Update(context.Background(), obj, metav1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})
}

// List retrieves all collectors stored in this store
func (ks *KubernetesStore) List() ([]kedge.Collector, error) {
	api := ks.Clientset.CoreV1().Secrets(ks.Namespace)
	cfgmap, err := api.Get(context.Background(), ks.Secret, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	var res []kedge.Collector
	for _, data := range cfgmap.Data {
		var c kedge.Collector
		err = json.Unmarshal([]byte(data), &c)
		if err != nil {
			return nil, err
		}
		res = append(res, c)
	}
	return res, nil
}

// Remove deletes a collector from this store
func (ks *KubernetesStore) Remove(name string) error {
	api := ks.Clientset.CoreV1().Secrets(ks.Namespace)
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		obj, err := api.Get(context.Background(), ks.Secret, metav1.GetOptions{})
		if err != nil {
			return err
		}
		if _, exists := obj.Data[name]; !exists {
			return nil
		}

		delete(obj.Data, name)
		_, err = api.Update(context.Background(), obj, metav1.UpdateOptions{})
		if err != nil {
			return err
		}

		return nil
	})
}
