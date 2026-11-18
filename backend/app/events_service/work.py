"""What a work account can run: GET /account/work.

One list per kind, each row with the person's role there:
- "owner": a restaurant or event venue they own;
- "staff": a venue whose owner added their address (core/members.py), or, for
  the demo staff account, every demo restaurant (the rule of
  restaurant_service/venue_access.load_for_staff);
- "organiser" / "staff" for events: their own events, then the events at the
  event venues they are a member of. Only organiser accounts reach the events
  routes, so a staff account gets no events.
"""

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import members
from app.events_service.event_types import event_type_label
from app.models import Event, Organiser, Venue


def _venue_row(venue: Venue, role: str) -> dict[str, Any]:
    row: dict[str, Any] = {
        "public_id": venue.public_id,
        "name": venue.name,
        "slug": venue.slug,
        "status": venue.status,
        "role": role,
    }
    if venue.kind == "event":
        row["venue_type"] = venue.venue_type
    return row


def _venue_roles(session: Session, user: Organiser) -> list[tuple[Venue, str]]:
    """Every venue this person works at with their role, owner first, then by id."""
    member_ids = set(members.member_venue_ids(session, user.email))
    conditions = [Venue.organiser_id == user.id]
    if member_ids:
        conditions.append(Venue.id.in_(member_ids))
    if user.role == "staff":
        conditions.append((Venue.kind == "restaurant") & Venue.is_demo.is_(True))
    found = []
    for venue in session.scalars(select(Venue).where(or_(*conditions)).order_by(Venue.id)):
        found.append((venue, "owner" if venue.organiser_id == user.id else "staff"))
    found.sort(key=lambda item: (item[1] != "owner", item[0].id))
    return found


def event_row(event: Event, venue: Venue, role: str) -> dict[str, Any]:
    return {
        "public_id": event.public_id,
        "name": event.name,
        "starts_at": event.starts_at,
        "ends_at": event.ends_at,
        "event_type": event.event_type,
        "event_type_label": event_type_label(event.event_type),
        "listed": event.listed,
        "venue_public_id": venue.public_id,
        "venue_name": venue.name,
        "role": role,
    }


def runnable_events(session: Session, user: Organiser) -> list[tuple[Event, Venue, str]]:
    """The events this organiser may open: their own, then those at member venues."""
    if user.role != "organiser":
        return []
    member_ids = members.member_venue_ids(session, user.email)
    condition = Event.organiser_id == user.id
    if member_ids:
        condition = condition | Event.venue_id.in_(member_ids)
    rows = session.execute(
        select(Event, Venue)
        .join(Venue, Venue.id == Event.venue_id)
        .where(condition)
        .order_by(Event.starts_at, Event.id)
    ).all()
    return [
        (event, venue, "organiser" if event.organiser_id == user.id else "staff")
        for event, venue in rows
    ]


def overview(session: Session, user: Organiser) -> dict[str, Any]:
    venues = _venue_roles(session, user)
    return {
        "user": {"email": user.email, "name": user.name, "role": user.role},
        "restaurants": [_venue_row(v, role) for v, role in venues if v.kind == "restaurant"],
        "event_venues": [_venue_row(v, role) for v, role in venues if v.kind == "event"],
        "events": [event_row(e, v, role) for e, v, role in runnable_events(session, user)],
    }
