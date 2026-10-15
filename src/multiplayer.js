import { useCallback, useEffect, useRef, useState } from "react";

const initial = { status: "solo", players: [], targets: [], error: "" };
const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
// The hosted room server only accepts origins listed in its ALLOWED_ORIGINS.
const HOSTED = "wss://mechverse-rooms.onrender.com/multiplayer";
const endpoint =
  import.meta.env.VITE_MULTIPLAYER_URL ||
  (local
    ? `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/multiplayer`
    : HOSTED);

export function useMultiplayer() {
  const [session, setSession] = useState(initial);
  const socket = useRef(null);
  const lastSend = useRef(0);
  const shotListeners = useRef(new Set());
  const eventListeners = useRef(new Set());
  const leave = useCallback(() => {
    const previous = socket.current;
    socket.current = null;
    previous?.close();
    setSession(initial);
  }, []);
  useEffect(
    () => () => {
      socket.current?.close();
      socket.current = null;
    },
    [],
  );
  const connect = useCallback((type, name, room, options = {}) => {
    socket.current?.close();
    socket.current = null;
    if (!endpoint) {
      setSession({
        ...initial,
        error:
          "Online rooms are not connected to a server yet. Solo play is available.",
      });
      return;
    }
    let ws;
    try {
      ws = new WebSocket(endpoint);
    } catch {
      setSession({ ...initial, error: "The room server address is invalid." });
      return;
    }
    socket.current = ws;
    setSession({ ...initial, status: "connecting" });
    const timer = setTimeout(() => {
      if (socket.current !== ws) return;
      socket.current = null;
      ws.close();
      setSession({
        ...initial,
        error:
          "Connection timed out. The room server may be waking up. Try again.",
      });
    }, 15000);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type,
          name,
          room: room.trim().toUpperCase(),
          cls: options.cls,
          pvp: Boolean(options.pvp),
          planet: options.planet,
          paint: options.paint,
        }),
      );
    ws.onmessage = (event) => {
      if (socket.current !== ws) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "welcome") {
        clearTimeout(timer);
        lastSend.current = 0;
        setSession({
          status: "connected",
          id: message.id,
          room: message.room,
          color: message.color,
          spawn: message.position,
          players: [],
          targets: [],
          wave: 1,
          cleared: false,
          pvp: Boolean(message.pvp),
          planet: message.planet || "proving",
          strikes: [],
          error: "",
        });
      } else if (message.type === "snapshot") {
        if (message.events?.length)
          for (const listener of eventListeners.current) listener(message.events);
        setSession((old) => ({
          ...old,
          players: message.players,
          targets: message.targets,
          enemies: message.enemies,
          bolts: message.bolts,
          strikes: message.strikes || [],
          wave: message.wave,
          cleared: message.cleared,
        }));
      } else if (message.type === "shot") {
        for (const listener of shotListeners.current) listener(message);
      } else if (message.type === "error") {
        clearTimeout(timer);
        socket.current = null;
        ws.close();
        setSession({ ...initial, error: message.message });
      }
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (socket.current !== ws) return;
      socket.current = null;
      setSession({
        ...initial,
        error: "Disconnected from the room. Join again or continue solo.",
      });
    };
    ws.onerror = () => {
      if (socket.current !== ws) return;
      clearTimeout(timer);
      socket.current = null;
      ws.close();
      setSession({
        ...initial,
        error:
          "Could not reach the room server. Check your connection and try again.",
      });
    };
  }, []);
  const sendMovement = useCallback((position, heading) => {
    const ws = socket.current;
    const now = performance.now();
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      ws.bufferedAmount > 8192 ||
      now - lastSend.current < 50
    )
      return;
    lastSend.current = now;
    ws.send(JSON.stringify({ type: "move", position, heading }));
  }, []);
  const sendFire = useCallback((origin, dir) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: "fire", origin, dir }));
  }, []);
  const sendReload = useCallback(() => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: "reload" }));
  }, []);
  const send = useCallback((data) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }, []);
  const sendClass = useCallback((cls) => send({ type: "class", cls }), [send]);
  const sendRepair = useCallback(() => send({ type: "repair" }), [send]);
  const sendFuse = useCallback(() => send({ type: "fuse" }), [send]);
  const sendInteract = useCallback(() => send({ type: "interact" }), [send]);
  const sendPaint = useCallback((paint) => send({ type: "paint", paint }), [send]);
  const onEvents = useCallback((listener) => {
    eventListeners.current.add(listener);
    return () => eventListeners.current.delete(listener);
  }, []);
  const onShot = useCallback((listener) => {
    shotListeners.current.add(listener);
    return () => shotListeners.current.delete(listener);
  }, []);
  return {
    ...session,
    sendFire,
    sendReload,
    sendClass,
    sendRepair,
    sendFuse,
    sendInteract,
    sendPaint,
    onEvents,
    onShot,
    available: Boolean(endpoint),
    connect,
    leave,
    sendMovement,
  };
}
