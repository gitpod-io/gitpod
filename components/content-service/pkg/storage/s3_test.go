// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package storage_test

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage/mock"
	"github.com/golang/mock/gomock"
)

type mockedS3PresignedAccess struct {
	storage.PresignedAccess
}

func (m mockedS3PresignedAccess) ForTestCreateObj(ctx context.Context, bucket, path, content string) error {
	return nil
}

func (m mockedS3PresignedAccess) ForTestReset(ctx context.Context) error {
	return nil
}

func TestS3PresignedHappyPath(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	s3c := mock.NewMockS3Client(ctrl)
	s3c.EXPECT().GetObjectAttributes(gomock.Any(), gomock.Any()).Return(&s3.GetObjectAttributesOutput{
		ETag:       aws.String("foobar"),
		ObjectSize: aws.Int64(100),
	}, nil).AnyTimes()
	s3c.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any()).Return(&s3.ListObjectsV2Output{
		Contents: []types.Object{
			{Size: aws.Int64(100)},
		},
	}, nil)

	ps3c := mock.NewMockPresignedS3Client(ctrl)
	ps3c.EXPECT().PresignGetObject(gomock.Any(), gomock.Any()).Return(&v4.PresignedHTTPRequest{
		URL: "some value",
	}, nil).AnyTimes()
	ps3c.EXPECT().PresignPutObject(gomock.Any(), gomock.Any()).Return(&v4.PresignedHTTPRequest{
		URL: "some value",
	}, nil).AnyTimes()

	dut := storage.NewPresignedS3Access(s3c, storage.S3Config{Bucket: "test-bucket"})
	dut.PresignedFactory = func() storage.PresignedS3Client { return ps3c }

	ps := mockedS3PresignedAccess{
		PresignedAccess: dut,
	}

	SuiteTestPresignedAccess(t, ps)
}
