"""
Shared ownership / visibility helpers.

Every resource (Agent, Scenario, Suite, TestRun) is visible to a user when:
  - They personally own it (owner_user_id = me), OR
  - It is assigned to a workspace they belong to (workspace_id IN their workspaces)

Use `ownership_filter` to build the WHERE clause, and `assert_owner` to guard
mutating operations that only the creator should perform (delete, etc.).
"""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace_members import WorkspaceMember


async def get_user_workspace_ids(user_id: UUID, db: AsyncSession) -> list[UUID]:
    """Return all workspace IDs the user belongs to (as owner or member)."""
    result = await db.execute(
        select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
    )
    return result.scalars().all()


def ownership_filter(model, user_id: UUID, workspace_ids: list[UUID]):
    """
    SQLAlchemy WHERE clause: user owns the resource OR it lives in one of
    their workspaces.
    """
    conditions = [model.owner_user_id == user_id]
    if workspace_ids:
        conditions.append(
            and_(model.workspace_id.isnot(None), model.workspace_id.in_(workspace_ids))
        )
    return or_(*conditions)


def assert_owner(resource, current_user_id: UUID, detail: str = "Only the owner can perform this action.") -> None:
    """Raise 403 if the current user is not the resource creator."""
    if resource.owner_user_id != current_user_id:
        raise HTTPException(status_code=403, detail=detail)


async def assert_workspace_member(workspace_id: UUID, user_id: UUID, db: AsyncSession) -> WorkspaceMember:
    """Raise 403 if the user is not a member of the given workspace."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this workspace.")
    return member
