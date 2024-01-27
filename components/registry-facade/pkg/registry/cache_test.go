// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registry

import (
	"context"
	"testing"
	"time"

	"github.com/containerd/containerd/content"
	"github.com/go-redis/redismock/v9"
	"github.com/google/go-cmp/cmp"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	redis "github.com/redis/go-redis/v9"
)

func TestRedisBlobStore_Info(t *testing.T) {
	ctx := context.Background()

	type Expectation struct {
		Info  content.Info
		Error string
	}
	tests := []struct {
		Name        string
		Content     string
		Expectation Expectation
	}{
		{
			Name: "not found",
			Expectation: Expectation{
				Error: "not found",
			},
		},
		{
			Name:    "invalid JSON",
			Content: "foo",
			Expectation: Expectation{
				Error: "cannot unmarshal blob info: invalid character 'o' in literal false (expecting 'a')",
			},
		},
		{
			Name:    "valid",
			Content: `{"Digest":"digest", "Size": 1234, "CreatedAt": 7899, "UpdatedAt": 9999, "Labels": {"foo":"bar"}}`,
			Expectation: Expectation{
				Info: content.Info{
					Digest:    "digest",
					Size:      1234,
					CreatedAt: time.Unix(7899, 0),
					UpdatedAt: time.Unix(9999, 0),
					Labels:    map[string]string{"foo": "bar"},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			client, mock := redismock.NewClientMock()

			dgst := digest.FromString(test.Content)
			if test.Content == "" {
				mock.ExpectGet("nfo." + string(dgst)).SetErr(redis.Nil)
			} else {
				mock.ExpectGet("nfo." + string(dgst)).SetVal(test.Content)
			}

			var (
				act   Expectation
				err   error
				store = &RedisBlobStore{Client: client}
			)
			act.Info, err = store.Info(ctx, dgst)
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Info() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRedisBlobStore_Writer(t *testing.T) {
	cnt := []byte("hello world")
	dgst := digest.FromBytes(cnt)

	client, mock := redismock.NewClientMock()
	mock.ExpectExists("cnt."+string(dgst), "nfo."+string(dgst)).SetVal(0)
	mock.ExpectMSet(
		"cnt."+string(dgst), string(cnt),
		"nfo."+string(dgst), `{"Digest":"`+string(dgst)+`","Size":11,"CreatedAt":1,"UpdatedAt":1,"Labels":{"foo":"bar"}}`,
	).SetVal("OK")

	store := &RedisBlobStore{Client: client}
	w, err := store.Writer(context.Background(), content.WithDescriptor(ociv1.Descriptor{
		Digest:    dgst,
		MediaType: ociv1.MediaTypeImageConfig,
	}))
	if err != nil {
		t.Fatal(err)
	}
	w.(*redisBlobWriter).forTestingOnlyTime = time.Unix(1, 1)
	_, _ = w.Write(cnt)
	w.Close()
	err = w.Commit(context.Background(), int64(len(cnt)), dgst, content.WithLabels(map[string]string{"foo": "bar"}))
	if err != nil {
		t.Fatal(err)
	}
}
