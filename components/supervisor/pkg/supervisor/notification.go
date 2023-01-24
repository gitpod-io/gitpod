// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"sync"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
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
		subscriptions:              make(map[uint64]*subscription),
		pendingNotifications:       make(map[uint64]*pendingNotification),
		pendingActiveNotifications: make(map[uint64]*pendingActiveNotification),
	}
}

// NotificationService implements the notification service API.
type NotificationService struct {
	mutex sync.Mutex

	nextSubscriptionID uint64
	subscriptions      map[uint64]*subscription
	activeSubscription *activeSubscription

	nextNotificationID         uint64
	pendingNotifications       map[uint64]*pendingNotification
	pendingActiveNotifications map[uint64]*pendingActiveNotification

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

type pendingActiveNotification struct {
	message         *api.SubscribeActiveResponse
	responseChannel chan *api.NotifyActiveResponse
	once            sync.Once
	closed          bool
}

func (pending *pendingActiveNotification) close() {
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

type activeSubscription struct {
	channel chan *api.SubscribeActiveResponse
	once    sync.Once
	closed  bool
	cancel  context.CancelFunc
}

func (s *activeSubscription) close() {
	s.once.Do(func() {
		close(s.channel)
		s.closed = true
		s.cancel()
	})
}

// RegisterGRPC registers a gRPC service.
func (srv *NotificationService) RegisterGRPC(s *grpc.Server) {
	api.RegisterNotificationServiceServer(s, srv)
}

// RegisterREST registers a REST service.
func (srv *NotificationService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterNotificationServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())})
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
	log.WithField("SubscribeRequest", req).Debug("Subscribe entered")
	defer log.WithField("SubscribeRequest", req).Debug("Subscribe exited")
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
			log.WithField("SubscribeRequest", req).Debug("Subscriber cancelled")
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
	log.WithField("pending", len(srv.pendingNotifications)).Debug("sending pending notifications")
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

// Called by the IDE to inform supervisor about which is the latest client
// actively used by the user. We consider active the last IDE with focus.
// Only 1 stream is kept open at any given time. A new subscription
// overrides the previous one, causing the stream to close.
// Supervisor will respond with a stream to which the IDE will listen
// waiting to receive actions to run, for example: `open` or `preview`
func (srv *NotificationService) SubscribeActive(req *api.SubscribeActiveRequest, resp api.NotificationService_SubscribeActiveServer) error {
	subscription := srv.acquireActiveSubscription(resp.Context())
	defer srv.releaseActiveSubscription(subscription)
	for {
		select {
		case subscribeResponse, ok := <-subscription.channel:
			if !ok || subscription.closed {
				return status.Errorf(codes.Aborted, "Active subscriber channel closed.")
			}
			err := resp.Send(subscribeResponse)
			if err != nil {
				return status.Errorf(codes.Internal, "Sending notification failed. %s", err)
			}
		case <-resp.Context().Done():
			log.WithField("SubscribeRequest", req).Debug("Active subscriber cancelled")
			return nil
		}
	}
}

// NotifyActive requests the active client to run a given command (eg. open or preview)
func (srv *NotificationService) NotifyActive(ctx context.Context, req *api.NotifyActiveRequest) (*api.NotifyActiveResponse, error) {
	if len(srv.pendingActiveNotifications) >= NotifierMaxPendingNotifications {
		return nil, status.Error(codes.ResourceExhausted, "Max number of pending notifications exceeded")
	}

	pending := srv.notifyActiveSubscriber(req)
	select {
	case resp, ok := <-pending.responseChannel:
		if !ok {
			log.Error("notify active response channel has been closed")
			return nil, status.Error(codes.Aborted, "response channel closed")
		}
		return resp, nil
	case <-ctx.Done():
		srv.mutex.Lock()
		defer srv.mutex.Unlock()
		// make sure the notification has not been responded in between these selectors
		_, ok := srv.pendingActiveNotifications[pending.message.RequestId]
		if ok {
			delete(srv.pendingActiveNotifications, pending.message.RequestId)
			pending.close()
		}
		return nil, ctx.Err()
	}
}

// NotifyActiveRespond informs the requesting client about the result (eg. success or
// failure) of the action (eg. open or preview) requested via NotifyActive
func (srv *NotificationService) NotifyActiveRespond(ctx context.Context, req *api.NotifyActiveRespondRequest) (*api.NotifyActiveRespondResponse, error) {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	pending, ok := srv.pendingActiveNotifications[req.RequestId]
	if !ok {
		log.WithFields(map[string]interface{}{
			"RequestId": req.RequestId,
		}).Info("Invalid or late response to notification")
		return nil, status.Errorf(codes.DeadlineExceeded, "Invalid or late response to notification")
	}
	if !pending.closed {
		pending.responseChannel <- req.Response
		pending.close()
	}
	delete(srv.pendingActiveNotifications, pending.message.RequestId)
	return &api.NotifyActiveRespondResponse{}, nil
}

func (srv *NotificationService) acquireActiveSubscription(ctx context.Context) *activeSubscription {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	if srv.activeSubscription != nil {
		srv.activeSubscription.close()
		srv.activeSubscription = nil
	}
	// account for some back pressure
	capacity := len(srv.pendingActiveNotifications)
	if SubscriberMaxPendingNotifications > capacity {
		capacity = SubscriberMaxPendingNotifications
	}
	channel := make(chan *api.SubscribeActiveResponse, capacity)
	log.WithField("pending", len(srv.pendingActiveNotifications)).Debug("sending pending active notifications")
	for _, pending := range srv.pendingActiveNotifications {
		channel <- pending.message
		if !isBlocking(pending.message.Request) {
			delete(srv.pendingActiveNotifications, pending.message.RequestId)
		}
	}
	_, cancel := context.WithCancel(ctx)
	subscription := &activeSubscription{
		channel: channel,
		cancel:  cancel,
	}
	srv.activeSubscription = subscription
	return subscription
}

func (srv *NotificationService) releaseActiveSubscription(subscription *activeSubscription) {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	subscription.close()
	if srv.activeSubscription == subscription {
		srv.activeSubscription = nil
	}
}

func (srv *NotificationService) notifyActiveSubscriber(req *api.NotifyActiveRequest) *pendingActiveNotification {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()
	var (
		requestID = srv.nextNotificationID
		message   = &api.SubscribeActiveResponse{
			RequestId: requestID,
			Request:   req,
		}
	)
	srv.nextNotificationID++
	subscription := srv.activeSubscription
	if subscription != nil {
		select {
		case subscription.channel <- message:
			// all good
		default:
			// subscriber doesn't consume messages fast enough
			log.WithField("subscription", req).Info("Cancelling unresponsive active subscriber")
			srv.activeSubscription = nil
			subscription.close()
		}
	}
	channel := make(chan *api.NotifyActiveResponse, 1)
	pending := &pendingActiveNotification{
		message:         message,
		responseChannel: channel,
	}
	srv.pendingActiveNotifications[requestID] = pending
	if !isBlocking(req) {
		// produce an immediate response
		channel <- &api.NotifyActiveResponse{}
		pending.close()
	}
	return pending
}

func isBlocking(req *api.NotifyActiveRequest) bool {
	open := req.GetOpen()
	return open != nil && open.Await
}
