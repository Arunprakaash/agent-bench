from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkspaceMemberResponse(BaseModel):
    user_id: UUID
    email: str
    display_name: str | None
    role: str
    joined_at: datetime


class WorkspaceListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    my_role: str
    member_count: int
    created_at: datetime
    updated_at: datetime


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    owner_user_id: UUID | None
    my_role: str
    members: list[WorkspaceMemberResponse]
    created_at: datetime
    updated_at: datetime


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"
