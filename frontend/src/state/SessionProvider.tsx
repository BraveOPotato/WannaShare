import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataConnection, Peer } from 'peerjs';

import { signalingUrl } from '../config';
import { SignalingClient, type ConnectionStatus } from '../lib/signalingClient';
import { createPeer, type DialMetadata } from '../lib/peerClient';
import { FileReceiver, sendFile, type SendHandle } from '../lib/fileTransfer';
import { shortId } from '../lib/random';
import type { WireMessage } from '../lib/wire';
import type { ChatItem, RemoteDevice, SessionPhase } from '../types';

import { useIdentity } from './IdentityProvider';
import { useFavorites } from './FavoritesProvider';
import { useSettings } from './SettingsProvider';

const AUTO_DECLINE_MS = 30_000;
const DIAL_TIMEOUT_MS = 35_000;

/** Identity of the peer on the other end of a connection. */
export interface RemoteInfo {
  deviceId?: string;
  displayName: string;
}

interface IncomingRequest {
  remote: RemoteInfo;
  deadline: number;
}

interface SessionContextValue {
  myPeerId: string | null;
  signalStatus: ConnectionStatus;
  phase: SessionPhase;
  lastNotice: string | null;
  clearNotice: () => void;

  // Listening (Send) side.
  code: string | null;
  refreshCode: () => Promise<void>;
  startListening: () => void;
  stopListening: () => void;

  // Presence.
  networkDevices: RemoteDevice[];
  favoritesOnline: RemoteDevice[];
  watchNetwork: (on: boolean) => void;

  // Dialing (caller) side.
  dial: (peerId: string, hint?: RemoteInfo) => void;
  resolveAndDial: (code: string) => Promise<void>;

  // Incoming request modal.
  incoming: IncomingRequest | null;
  acceptIncoming: () => void;
  declineIncoming: () => void;

  // Active chat session.
  remote: RemoteInfo | null;
  items: ChatItem[];
  sendText: (text: string) => void;
  sendFiles: (files: FileList | File[]) => void;
  cancelFile: (id: string) => void;
  retryFile: (id: string) => void;
  leaveSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface LiveConn {
  conn: DataConnection;
  role: 'caller' | 'callee';
  remote: RemoteInfo;
  /** caller: callee accepted (their hello arrived); callee: user accepted. */
  established: boolean;
  helloSent: boolean;
  receivers: Map<string, FileReceiver>;
  outgoing: Map<string, { file: File; handle?: SendHandle }>;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const { favorites } = useFavorites();
  const { effectiveIceServers } = useSettings();

  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [signalStatus, setSignalStatus] = useState<ConnectionStatus>('connecting');
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [networkDevices, setNetworkDevices] = useState<RemoteDevice[]>([]);
  const [favoritesOnline, setFavoritesOnline] = useState<RemoteDevice[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest | null>(null);
  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [lastNotice, setLastNotice] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const liveRef = useRef<LiveConn | null>(null); // the accepted / dialing session
  const pendingLiveRef = useRef<LiveConn | null>(null); // incoming, awaiting decision
  const autoDeclineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values readable from stable event handlers (avoid stale closures /
  // rebinding the peer on every render).
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const incomingHandlerRef = useRef<(conn: DataConnection) => void>(() => {});

  const clearNotice = useCallback(() => setLastNotice(null), []);

  const updateItem = useCallback((id: string, patch: Partial<ChatItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? ({ ...it, ...patch } as ChatItem) : it)),
    );
  }, []);

  // --- Connection helpers --------------------------------------------------

  const sendHello = useCallback((live: LiveConn) => {
    if (live.helloSent) return;
    const me = identityRef.current;
    try {
      live.conn.send({ k: 'hello', deviceId: me.deviceId, displayName: me.displayName });
      live.helloSent = true;
    } catch {
      /* channel not open yet; retried on 'open' */
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (dialTimeoutRef.current) clearTimeout(dialTimeoutRef.current);
    dialTimeoutRef.current = null;
  }, []);

  const goToChat = useCallback(
    (live: LiveConn) => {
      liveRef.current = live;
      setRemote(live.remote);
      setItems([]);
      setPhase('connected');
      navigate('/chat');
    },
    [navigate],
  );

  const teardownLive = useCallback(
    (notice?: string) => {
      clearTimers();
      const live = liveRef.current;
      if (live) {
        live.outgoing.forEach((o) => o.handle?.cancel());
        try {
          live.conn.close();
        } catch {
          /* ignore */
        }
      }
      liveRef.current = null;
      setRemote(null);
      if (notice) setLastNotice(notice);
    },
    [clearTimers],
  );

  const clearIncoming = useCallback(() => {
    if (autoDeclineRef.current) clearTimeout(autoDeclineRef.current);
    autoDeclineRef.current = null;
    pendingLiveRef.current = null;
    setIncoming(null);
  }, []);

  const handleWireMessage = useCallback(
    (live: LiveConn, data: unknown) => {
      const msg = data as WireMessage;
      switch (msg.k) {
        case 'hello': {
          live.remote = { deviceId: msg.deviceId, displayName: msg.displayName };
          if (pendingLiveRef.current === live) {
            setIncoming((prev) => (prev ? { ...prev, remote: live.remote } : prev));
          } else {
            setRemote((prev) => (prev ? { ...prev, ...live.remote } : live.remote));
          }
          if (live.role === 'caller' && !live.established) {
            live.established = true;
            clearTimers();
            goToChat(live);
          }
          break;
        }
        case 'chat':
          setItems((prev) => [
            ...prev,
            { type: 'text', id: msg.id, direction: 'in', text: msg.text, ts: msg.ts, state: 'received' },
          ]);
          break;
        case 'file:meta':
          live.receivers.set(msg.id, new FileReceiver(msg));
          setItems((prev) => [
            ...prev,
            {
              type: 'file', id: msg.id, direction: 'in', name: msg.name, size: msg.size,
              mime: msg.mime, ts: msg.ts, state: 'sending', progress: 0,
            },
          ]);
          break;
        case 'file:chunk': {
          const receiver = live.receivers.get(msg.id);
          if (receiver) updateItem(msg.id, { progress: receiver.addChunk(msg.i, msg.data) });
          break;
        }
        case 'file:done': {
          const receiver = live.receivers.get(msg.id);
          if (!receiver) break;
          if (receiver.complete) {
            updateItem(msg.id, { state: 'received', progress: 1, url: receiver.toObjectUrl() });
            try {
              live.conn.send({ k: 'file:ack', id: msg.id });
            } catch {
              /* ignore */
            }
          } else {
            updateItem(msg.id, { state: 'failed' });
          }
          live.receivers.delete(msg.id);
          break;
        }
        case 'file:ack':
          updateItem(msg.id, { state: 'sent', progress: 1 });
          break;
        case 'file:cancel':
          updateItem(msg.id, { state: 'canceled' });
          live.receivers.delete(msg.id);
          break;
      }
    },
    [clearTimers, goToChat, updateItem],
  );

  const attachConnHandlers = useCallback(
    (live: LiveConn) => {
      const { conn } = live;
      conn.on('open', () => {
        if (live.role === 'caller' || live.established) sendHello(live);
      });
      conn.on('data', (data) => handleWireMessage(live, data));
      conn.on('close', () => {
        if (liveRef.current === live) {
          const wasEstablished = live.established;
          teardownLive();
          if (wasEstablished) {
            setPhase('closed');
            setLastNotice('Connection closed.');
            navigate('/');
          } else {
            setPhase('idle');
            setLastNotice('The other device declined or is unavailable.');
          }
        } else if (pendingLiveRef.current === live) {
          clearIncoming();
          setPhase(phaseRef.current === 'incoming' ? 'idle' : phaseRef.current);
        }
      });
      conn.on('error', () => {
        if (liveRef.current === live) {
          teardownLive('Connection error.');
          setPhase('closed');
        }
      });
    },
    [clearIncoming, handleWireMessage, navigate, sendHello, teardownLive],
  );

  // --- Incoming (callee) ---------------------------------------------------

  const declineIncoming = useCallback(() => {
    const live = pendingLiveRef.current;
    const resume = phaseRef.current === 'incoming' ? 'idle' : phaseRef.current;
    if (live) {
      try {
        live.conn.close();
      } catch {
        /* ignore */
      }
    }
    clearIncoming();
    setPhase(resume === 'incoming' ? 'idle' : resume);
  }, [clearIncoming]);

  const declineRef = useRef(declineIncoming);
  declineRef.current = declineIncoming;

  const acceptIncoming = useCallback(() => {
    const live = pendingLiveRef.current;
    if (!live) return;
    live.established = true;
    clearIncoming();
    if (live.conn.open) sendHello(live);
    goToChat(live);
  }, [clearIncoming, goToChat, sendHello]);

  // The incoming-connection handler is refreshed every render so it always
  // sees the latest callbacks, while the peer only binds a stable wrapper.
  incomingHandlerRef.current = (conn: DataConnection) => {
    if (liveRef.current || pendingLiveRef.current) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
      return;
    }
    const meta = (conn.metadata ?? {}) as Partial<DialMetadata>;
    const live: LiveConn = {
      conn,
      role: 'callee',
      remote: { deviceId: meta.deviceId, displayName: meta.displayName || 'Unknown device' },
      established: false,
      helloSent: false,
      receivers: new Map(),
      outgoing: new Map(),
    };
    pendingLiveRef.current = live;
    attachConnHandlers(live);

    phaseRef.current = 'incoming';
    setPhase('incoming');
    setIncoming({ remote: live.remote, deadline: Date.now() + AUTO_DECLINE_MS });
    autoDeclineRef.current = setTimeout(() => declineRef.current(), AUTO_DECLINE_MS);
  };

  // --- Dialing (caller) ----------------------------------------------------

  const dial = useCallback(
    (peerId: string, hint?: RemoteInfo) => {
      const peer = peerRef.current;
      if (!peer || !myPeerId) {
        setLastNotice('Still connecting to the network — try again in a moment.');
        return;
      }
      if (peerId === myPeerId) {
        setLastNotice("That's this device's own code.");
        return;
      }
      if (liveRef.current || pendingLiveRef.current) {
        setLastNotice('Finish or leave the current chat first.');
        return;
      }
      const me = identityRef.current;
      const metadata: DialMetadata = { deviceId: me.deviceId, displayName: me.displayName };
      const conn = peer.connect(peerId, { reliable: true, serialization: 'binary', metadata });
      const live: LiveConn = {
        conn,
        role: 'caller',
        remote: { deviceId: hint?.deviceId, displayName: hint?.displayName || 'Connecting…' },
        established: false,
        helloSent: false,
        receivers: new Map(),
        outgoing: new Map(),
      };
      liveRef.current = live;
      setRemote(live.remote);
      setPhase('dialing');
      attachConnHandlers(live);
      dialTimeoutRef.current = setTimeout(() => {
        if (liveRef.current === live && !live.established) {
          teardownLive('No answer.');
          setPhase('idle');
        }
      }, DIAL_TIMEOUT_MS);
    },
    [attachConnHandlers, myPeerId, teardownLive],
  );

  const resolveAndDial = useCallback(
    async (inputCode: string) => {
      const signaling = signalingRef.current;
      if (!signaling) return;
      const peerId = await signaling.resolveCode(inputCode);
      if (!peerId) {
        setLastNotice('That code is invalid or has expired.');
        return;
      }
      dial(peerId);
    },
    [dial],
  );

  // --- Chat / files --------------------------------------------------------

  const sendText = useCallback(
    (text: string) => {
      const live = liveRef.current;
      const trimmed = text.trim();
      if (!live || !trimmed) return;
      const id = shortId();
      const ts = Date.now();
      setItems((prev) => [
        ...prev,
        { type: 'text', id, direction: 'out', text: trimmed, ts, state: 'sending' },
      ]);
      try {
        live.conn.send({ k: 'chat', id, text: trimmed, ts });
        updateItem(id, { state: 'sent' });
      } catch {
        updateItem(id, { state: 'failed' });
      }
    },
    [updateItem],
  );

  const startSend = useCallback(
    (live: LiveConn, id: string, file: File) => {
      const { promise, handle } = sendFile(live.conn, id, file, (progress) =>
        updateItem(id, { progress }),
      );
      const record = live.outgoing.get(id);
      if (record) record.handle = handle;
      promise.catch((err: unknown) => {
        updateItem(id, {
          state: err instanceof DOMException && err.name === 'AbortError' ? 'canceled' : 'failed',
        });
      });
      // 'sent' is set when the peer's file:ack arrives.
    },
    [updateItem],
  );

  const sendFiles = useCallback(
    (files: FileList | File[]) => {
      const live = liveRef.current;
      if (!live) return;
      Array.from(files).forEach((file) => {
        const id = shortId();
        live.outgoing.set(id, { file });
        setItems((prev) => [
          ...prev,
          {
            type: 'file', id, direction: 'out', name: file.name, size: file.size,
            mime: file.type || 'application/octet-stream', ts: Date.now(),
            state: 'sending', progress: 0,
          },
        ]);
        startSend(live, id, file);
      });
    },
    [startSend],
  );

  const cancelFile = useCallback((id: string) => {
    liveRef.current?.outgoing.get(id)?.handle?.cancel();
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      const live = liveRef.current;
      const record = live?.outgoing.get(id);
      if (!live || !record) return;
      updateItem(id, { state: 'sending', progress: 0 });
      startSend(live, id, record.file);
    },
    [startSend, updateItem],
  );

  const leaveSession = useCallback(() => {
    teardownLive();
    setPhase('idle');
    setItems([]);
    navigate('/');
  }, [navigate, teardownLive]);

  // --- Listening / codes / presence ----------------------------------------

  const refreshCode = useCallback(async () => {
    const signaling = signalingRef.current;
    if (!signaling) return;
    try {
      const { code: fresh } = await signaling.createCode();
      setCode(fresh);
    } catch {
      setLastNotice('Could not reach the coordination server for a code.');
    }
  }, []);

  const startListening = useCallback(() => {
    setPhase('listening');
    void refreshCode();
  }, [refreshCode]);

  const stopListening = useCallback(() => {
    setPhase((p) => (p === 'listening' ? 'idle' : p));
  }, []);

  const watchNetwork = useCallback((on: boolean) => {
    signalingRef.current?.watchNetwork(on);
    if (!on) setNetworkDevices([]);
  }, []);

  // --- Lifecycle: signaling ------------------------------------------------

  useEffect(() => {
    const signaling = new SignalingClient(signalingUrl);
    signalingRef.current = signaling;
    signaling.on('status', setSignalStatus);
    signaling.on('network', setNetworkDevices);
    signaling.on('favorites', setFavoritesOnline);
    signaling.connect();
    return () => {
      signaling.close();
      signalingRef.current = null;
    };
  }, []);

  // --- Lifecycle: peer (rebuilds only when ICE config changes) -------------

  const iceKey = useMemo(() => JSON.stringify(effectiveIceServers), [effectiveIceServers]);

  useEffect(() => {
    if (liveRef.current || pendingLiveRef.current) return; // never disrupt a session
    const peer = createPeer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      const me = identityRef.current;
      signalingRef.current?.register(me.deviceId, id, me.displayName);
    });
    peer.on('connection', (conn) => incomingHandlerRef.current(conn));
    peer.on('disconnected', () => {
      try {
        peer.reconnect();
      } catch {
        /* ignore */
      }
    });
    peer.on('error', (err) => {
      const type = (err as { type?: string }).type;
      if (type === 'peer-unavailable') {
        if (liveRef.current?.role === 'caller' && !liveRef.current.established) {
          teardownLive('That device is offline.');
          setPhase('idle');
        }
      }
    });

    return () => {
      peer.destroy();
      peerRef.current = null;
      setMyPeerId(null);
    };
  }, [iceKey, teardownLive]);

  // Re-announce presence + refresh the peer's label when our name changes.
  useEffect(() => {
    if (myPeerId) {
      signalingRef.current?.register(identity.deviceId, myPeerId, identity.displayName);
    }
    const live = liveRef.current;
    if (live) {
      live.helloSent = false;
      sendHello(live);
    }
  }, [identity.deviceId, identity.displayName, myPeerId, sendHello]);

  // Keep favorites-presence subscription synced to the saved list.
  useEffect(() => {
    signalingRef.current?.watchFavorites(favorites.map((f) => f.deviceId));
    if (favorites.length === 0) setFavoritesOnline([]);
  }, [favorites, signalStatus]);

  const value = useMemo<SessionContextValue>(
    () => ({
      myPeerId, signalStatus, phase, lastNotice, clearNotice,
      code, refreshCode, startListening, stopListening,
      networkDevices, favoritesOnline, watchNetwork,
      dial, resolveAndDial,
      incoming, acceptIncoming, declineIncoming,
      remote, items, sendText, sendFiles, cancelFile, retryFile, leaveSession,
    }),
    [
      myPeerId, signalStatus, phase, lastNotice, clearNotice, code, refreshCode,
      startListening, stopListening, networkDevices, favoritesOnline, watchNetwork,
      dial, resolveAndDial, incoming, acceptIncoming, declineIncoming, remote, items,
      sendText, sendFiles, cancelFile, retryFile, leaveSession,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
