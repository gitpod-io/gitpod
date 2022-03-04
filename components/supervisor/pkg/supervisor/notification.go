// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"sync"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

const (
	NotifierMaxPendingNotifications   = 120
	SubscriberMaxPendingNotifications = 100
)

// NewNotificationService creates a new notification service.
func NewNotificationService() *NotificationService {
	return &NotificationService{
		subscriptions:        make(map[uint64]*subscription),
		pendingNotifications: make(map[uint64]*pendingNotification),
	}
}

// NotificationService implements the notification service API.
type NotificationService struct {
	mutex                sync.Mutex
	nextSubscriptionID   uint64
	subscriptions        map[uint64]*subscription
	nextNotificationID   uint64
	pendingNotifications map[uint64]*pendingNotification

	api.UnimplementedNotificationServiceServer
}

type pendingNotification struct {
	message         *api.SubscribeResponse
	responseChannel chan *api.NotifyResponse
	once            sync.Once
	closed          bool
}

func (pending *pendingNotification) close() {
	pending.once.Do(func() {
		close(pending.responseChannel)
		pending.closed = true
	})
}

type subscription struct {
	id      uint64
	channel chan *api.SubscribeResponse
	once    sync.Once
	closed  bool
	cancel  context.CancelFunc
}

func (subscription *subscription) close() {
	subscription.once.Do(func() {
		close(subscription.channel)
		subscription.closed = true
		subscription.cancel()
	})
}

// RegisterGRPC registers a gRPC service.
func (srv *NotificationService) RegisterGRPC(s *grpc.Server) {
	api.RegisterNotificationServiceServer(s, srv)
}

// RegisterREST registers a REST service.
func (srv *NotificationService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterNotificationServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

// Notify sends a notification to the user.
func (srv *NotificationService) Notify(ctx context.Context, req *api.NotifyRequest) (*api.NotifyResponse, error) {
	if len(srv.pendingNotifications) >= NotifierMaxPendingNotifications {
		return nil, status.Error(codes.ResourceExhausted, "Max number of pending notifications exceeded")
	}

	pending := srv.notifySubscribers(req)
	select {
	case resp, ok := <-pending.responseChannel:
		if !ok {
			log.Error("notify response channel has been closed")
			return nil, status.Error(codes.Aborted, "response channel closed")
		}
		log.WithField("NotifyResponse", resp).Info("sending notify response")
		return resp, nil
	case <-ctx.Done():
		log.Info("notify cancelled")
		srv.mutex.Lock()
		defer srv.mutex.Unlock()
		// make sure the notification has not been responded in between these selectors
		_, ok := srv.pendingNotifications[pending.message.RequestId]
		if ok {
			delete(srv.pendingNotifications, pending.message.RequestId)
			pending.close()
		}
		return nil, ctx.Err()
	}
}

func (srv *NotificationService) notifySubscribers(req *api.NotifyRequest) *pendingNotification {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	var (
		requestID = srv.nextNotificationID
		message   = &api.SubscribeResponse{
			RequestId: requestID,
			Request:   req,
		}
	)
	srv.nextNotificationID++
	for _, subscription := range srv.subscriptions {
		select {
		case subscription.channel <- message:
			// all good
		default:
			// subscriber doesn't consume messages fast enough
			log.WithField("subscription", req).Info("Cancelling unresponsive subscriber")
			delete(srv.subscriptions, subscription.id)
			subscription.close()
		}
	}
	channel := make(chan *api.NotifyResponse, 1)
	pending := &pendingNotification{
		message:         message,
		responseChannel: channel,
	}
	srv.pendingNotifications[requestID] = pending
	if len(req.Actions) == 0 {
		// produce an immediate response
		channel <- &api.NotifyResponse{}
		pending.close()
	}
	return pending
}

// Subscribe subscribes to notifications that are sent to the supervisor.
func (srv *NotificationService) Subscribe(req *api.SubscribeRequest, resp api.NotificationService_SubscribeServer) error {
	log.WithField("SubscribeRequest", req).Info("Subscribe entered")
	defer log.WithField("SubscribeRequest", req).Info("Subscribe exited")
	subscription := srv.subscribeLocked(req, resp)
	defer srv.unsubscribeLocked(subscription.id)
	for {
		select {
		case subscribeResponse, ok := <-subscription.channel:
			if !ok || subscription.closed {
				return status.Errorf(codes.Aborted, "Subscriber channel closed.")
			}
			err := resp.Send(subscribeResponse)
			if err != nil {
				return status.Errorf(codes.Internal, "Sending notification failed. %s", err)
			}
		case <-resp.Context().Done():
			log.WithField("SubscribeRequest", req).Info("Subscriber cancelled")
			return nil
		}
	}
}

func (srv *NotificationService) subscribeLocked(req *api.SubscribeRequest, resp api.NotificationService_SubscribeServer) *subscription {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	// account for some back pressure
	capacity := len(srv.pendingNotifications)
	if SubscriberMaxPendingNotifications > capacity {
		capacity = SubscriberMaxPendingNotifications
	}
	channel := make(chan *api.SubscribeResponse, capacity)
	log.WithField("pending", len(srv.pendingNotifications)).Info("sending pending notifications")
	for id, pending := range srv.pendingNotifications {
		channel <- pending.message
		if len(pending.message.Request.Actions) == 0 {
			delete(srv.pendingNotifications, id)
		}
	}
	id := srv.nextSubscriptionID
	srv.nextSubscriptionID++
	_, cancel := context.WithCancel(resp.Context())
	subscription := &subscription{
		channel: channel,
		id:      id,
		cancel:  cancel,
	}
	srv.subscriptions[id] = subscription
	return subscription
}

func (srv *NotificationService) unsubscribeLocked(subscriptionID uint64) {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	subscription, ok := srv.subscriptions[subscriptionID]
	if !ok {
		log.Errorf("Could not unsubscribe subscriber")
		return
	}
	delete(srv.subscriptions, subscription.id)
	subscription.close()
}

// Respond reports user actions as response to a notification request.
func (srv *NotificationService) Respond(ctx context.Context, req *api.RespondRequest) (*api.RespondResponse, error) {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	pending, ok := srv.pendingNotifications[req.RequestId]
	if !ok {
		log.WithFields(map[string]interface{}{
			"RequestId": req.RequestId,
			"Action":    req.Response.Action,
		}).Info("Invalid or late response to notification")
		return nil, status.Errorf(codes.DeadlineExceeded, "Invalid or late response to notification")
	}
	if !isActionAllowed(req.Response.Action, pending.message.Request) {
		log.WithFields(map[string]interface{}{
			"Notification": pending.message,
			"Action":       req.Response.Action,
		}).Error("Invalid user action on notification")
		return nil, status.Errorf(codes.InvalidArgument, "Invalid user action on notification")
	}
	if !pending.closed {
		pending.responseChannel <- req.Response
		pending.close()
	}
	delete(srv.pendingNotifications, pending.message.RequestId)
	return &api.RespondResponse{}, nil
}

func isActionAllowed(action string, req *api.NotifyRequest) bool {
	if action == "" {
		// user cancelled, which is always allowed
		return true
	}
	for _, allowedAction := range req.Actions {
		if allowedAction == action {
			return true
		}
	}
	return false
}
