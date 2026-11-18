// The Staff side of /account (GET /account/work): the restaurants, event venues and events
// this account can run, each with its role. Owners also get the owner pages, Team included.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getAccountWork } from "../../api/account";
import type { WorkEvent, WorkEventVenue, WorkRestaurant } from "../../api/account";
import { ApiError, clearSessionToken } from "../../api/client";
import { Badge, ErrorState, Skeleton } from "../../design/components";
import { errorMessage } from "../restaurant/format";
import { useLoad } from "../restaurant/useLoad";
import { shortDateTime, workRoleLabel } from "../events-public/eventsModel";

export function StaffPanel({ onSessionGone }: { onSessionGone: () => void }) {
  const work = useLoad(getAccountWork, "account-work");
  const gone = work.state.status === "error" && work.state.error instanceof ApiError && work.state.error.code === "unauthorised";
  useEffect(() => {
    if (!gone) return;
    // The work session is over (expired, or the password changed): forget it here, as client.ts does for guests.
    clearSessionToken();
    onSessionGone();
  }, [gone, onSessionGone]);
  if (work.state.status === "loading") return <Skeleton lines={5} label="Loading your staff tools" />;
  if (work.state.status === "error") {
    return gone ? null : <ErrorState title="Could not load your staff tools" message={errorMessage(work.state.error)} onRetry={() => work.reload()} />;
  }
  const { restaurants, event_venues: venues, events } = work.state.data;
  return (
    <div className="ya-panel">
      <section aria-labelledby="ya-restaurants-title" className="ya-section">
        <h2 id="ya-restaurants-title">Restaurants</h2>
        {restaurants.length === 0 ? (
          <p>No restaurants yet. When an owner adds your email to their team, the restaurant appears here.</p>
        ) : (
          <ul className="ep-staff-list">
            {restaurants.map((r) => (
              <RestaurantRow key={r.public_id} restaurant={r} />
            ))}
          </ul>
        )}
        <p className="ya-more">
          <Link to="/owner">Restaurant owner area</Link>
        </p>
      </section>
      <section aria-labelledby="ya-venues-title" className="ya-section">
        <h2 id="ya-venues-title">Event venues</h2>
        {venues.length === 0 ? (
          <p>No halls or quintas yet. When a venue adds your email to its team, it appears here.</p>
        ) : (
          <ul className="ep-staff-list">
            {venues.map((v) => (
              <VenueRow key={v.public_id} venue={v} />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="ya-events-staff-title" className="ya-section">
        <h2 id="ya-events-staff-title">Events</h2>
        {events.length === 0 ? (
          <p>No events to run yet.</p>
        ) : (
          <ul className="ep-staff-list">
            {events.map((e) => (
              <EventRow key={e.public_id} event={e} />
            ))}
          </ul>
        )}
        <p className="ya-more">
          <Link to="/events/staff">Event staff: events by type</Link>
        </p>
      </section>
    </div>
  );
}

function RoleBadge({ role }: { role: "owner" | "staff" | "organiser" }) {
  return <Badge tone={role === "staff" ? "info" : "success"}>{workRoleLabel(role)}</Badge>;
}

function RestaurantRow({ restaurant: r }: { restaurant: WorkRestaurant }) {
  const owner = `/owner/${encodeURIComponent(r.public_id)}`;
  return (
    <li className="ep-staff-row">
      <div>
        <h3>
          {r.name} <RoleBadge role={r.role} />
        </h3>
        <p>{r.status === "published" ? "Live on SeatPlan" : "Draft, not published yet"}</p>
        {r.role === "owner" && (
          <nav className="ya-owner-links" aria-label={`Manage ${r.name}`}>
            <Link to={`${owner}/profile`}>Profile</Link>
            <Link to={`${owner}/rooms`}>Floor plan</Link>
            <Link to={`${owner}/team`}>Team</Link>
            <Link to={`${owner}/review`}>Publishing</Link>
          </nav>
        )}
      </div>
      <Link className="btn btn-primary" to={`/staff/${encodeURIComponent(r.public_id)}`}>
        Open service floor<span className="visually-hidden"> of {r.name}</span>
      </Link>
    </li>
  );
}

function VenueRow({ venue: v }: { venue: WorkEventVenue }) {
  const kind = v.venue_type === "quinta" ? "Quinta" : v.venue_type === "hall" ? "Event hall" : "Event venue";
  return (
    <li className="ep-staff-row">
      <div>
        <h3>
          {v.name} <RoleBadge role={v.role} />
        </h3>
        <p>{kind}</p>
      </div>
      {v.slug && v.status === "published" && (
        <Link className="btn btn-secondary" to={`/venues/${encodeURIComponent(v.slug)}`}>
          Public page<span className="visually-hidden"> of {v.name}</span>
        </Link>
      )}
    </li>
  );
}

export function EventRow({ event: e }: { event: Pick<WorkEvent, "public_id" | "name" | "starts_at" | "event_type_label" | "venue_name" | "role"> }) {
  return (
    <li className="ep-staff-row">
      <div>
        {e.event_type_label && <p className="ep-type">{e.event_type_label}</p>}
        <h3>
          {e.name} <RoleBadge role={e.role} />
        </h3>
        <p>
          <time dateTime={e.starts_at}>{shortDateTime(e.starts_at)}</time>
          {e.venue_name && ` · ${e.venue_name}`}
        </p>
      </div>
      <Link className="btn btn-primary" to={`/organiser/${encodeURIComponent(e.public_id)}`}>
        Open organiser workspace<span className="visually-hidden"> for {e.name}</span>
      </Link>
    </li>
  );
}
