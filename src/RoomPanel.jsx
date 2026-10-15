import React, { useEffect, useState } from "react";
import { CLASSES } from "../shared/arena.js";
import { PLANETS, PLANET_IDS, planetOf } from "../shared/planets.js";
export function RoomPanel({ network, settings, startOpen }) {
  const { cls, paint } = settings;
  const [name, setName] = useState(settings.name);
  const [versus, setVersus] = useState(false);
  const [planet, setPlanet] = useState(settings.planet);
  const [room, setRoom] = useState(
    () => new URLSearchParams(location.search).get("room") || "",
  );
  const [copyStatus, setCopyStatus] = useState("");
  // Opening "Play with friends" from the menu expands the panel.
  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen]);
  // Phones start collapsed so the arena stays visible, unless an invite was opened.
  const [open, setOpen] = useState(
    () => startOpen || Boolean(room),
  );
  const busy = network.status === "connecting";
  const connected = network.status === "connected";
  const invite = new URL(location.href);
  invite.search = "";
  invite.hash = "";
  if (connected) invite.searchParams.set("room", network.room);
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite.href);
      setCopyStatus("Invite copied");
    } catch {
      setCopyStatus("Copy the invite link below.");
    }
  }
  return (
    <aside className="room-panel" aria-label="Private multiplayer room">
      <h2>
        <button
          className="room-toggle"
          aria-expanded={open || Boolean(network.error)}
          onClick={() => setOpen((v) => !v)}
        >
          {connected ? `Your squad (${network.players.length}/4)` : "Play with friends"}
          <span aria-hidden="true">{open ? " ▴" : " ▾"}</span>
        </button>
      </h2>
      <div className="room-body" hidden={!open && !network.error}>
      <p className="room-note">
        {connected && network.pvp
          ? "Versus · Pilots and enemies can hit you"
          : "Squad defense · Clear targets and enemies together"}
      </p>
      {network.error && (
        <p role="alert" className="room-error">
          {network.error}
        </p>
      )}
      {!network.available && (
        <p>Rooms need a connected multiplayer server. Solo play is ready.</p>
      )}
      {connected ? (
        <>
          <p>
            Room <strong>{network.room}</strong> · {network.players.length}/4
            pilots · {network.pvp ? "Versus" : "Co-op"} · {planetOf(network.planet).name}
          </p>
          <ul>
            {network.players.map((p) => (
              <li key={p.id}>
                <span aria-hidden="true" style={{ color: p.color }}>
                  ●{" "}
                </span>
                {p.name}
                {p.id === network.id ? " (you)" : ""}
                <span className="pilot-class"> · {CLASSES[p.cls]?.name ?? "Assault"}</span>
                {p.down ? " · down" : ""}
                <span className="score">{p.score ?? 0}</span>
              </li>
            ))}
          </ul>
          <button onClick={copyInvite}>Copy invite link</button>
          <label>
            Invite link
            <input
              readOnly
              value={invite.href}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p role="status">{copyStatus}</p>
          <button
            onClick={() => {
              network.leave();
              setCopyStatus("");
            }}
          >
            Leave room
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            network.connect("join", name, room, { cls, paint });
          }}
        >
          <label>
            Pilot name
            <input
              maxLength={20}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="Your callsign"
              required
            />
          </label>
          <label>
            Planet
            <select value={planet} onChange={(e) => setPlanet(e.target.value)} disabled={busy}>
              {PLANET_IDS.map((id) => (
                <option key={id} value={id}>
                  {PLANETS[id].name}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={versus}
              onChange={(e) => setVersus(e.target.checked)}
              disabled={busy}
            />
            Versus: pilots can damage each other
          </label>
          <button
            type="button"
            disabled={busy || !name.trim() || !network.available}
            onClick={() => network.connect("create", name, "", { cls, paint, pvp: versus, planet })}
          >
            Create private room
          </button>
          <label>
            Room code
            <input
              maxLength={12}
              value={room}
              onChange={(e) =>
                setRoom(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))
              }
              disabled={busy}
              placeholder="12-character invite code"
            />
          </label>
          <button
            disabled={
              busy ||
              !name.trim() ||
              !/^[A-F0-9]{12}$/.test(room) ||
              !network.available
            }
          >
            Join room
          </button>
          {busy && (
            <>
              <p role="status">Connecting…</p>
              <button type="button" onClick={network.leave}>
                Cancel
              </button>
            </>
          )}
        </form>
      )}
      </div>
    </aside>
  );
}
