import React, { useState } from "react";
export function RoomPanel({ network }) {
  const [name, setName] = useState("");
  const [room, setRoom] = useState(
    () => new URLSearchParams(location.search).get("room") || "",
  );
  const [copyStatus, setCopyStatus] = useState("");
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
      <h2>{connected ? "Your squad" : "Play with friends"}</h2>
      <p className="room-note">Squad target run · Clear waves together</p>
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
            pilots
          </p>
          <ul>
            {network.players.map((p) => (
              <li key={p.id}>
                <span aria-hidden="true" style={{ color: p.color }}>
                  ●{" "}
                </span>
                {p.name}
                {p.id === network.id ? " (you)" : ""}
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
            network.connect("join", name, room);
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
          <button
            type="button"
            disabled={busy || !name.trim() || !network.available}
            onClick={() => network.connect("create", name, "")}
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
    </aside>
  );
}
