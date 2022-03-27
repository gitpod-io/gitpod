package db

import "context"

type TeamMemberRole string

const (
	TeamMemberRole_Owner  = "owner"
	TeamMemberRole_Member = "member"
)

type TeamMembership struct {
	ID     string
	TeamID string
	UserID string
	Role   TeamMemberRole

	CreationTime string
	Deleted      bool
}

type TeamMembershipRepository interface {
	ListByTeam(ctx context.Context, teamID string) ([]*TeamMembership, error)
}
