import { useState } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button, IconButton } from '../ui/primitives';
import { useSettings } from '../../state/SettingsProvider';
import type { IceServer } from '../../types';

interface Row {
  urls: string;
  username: string;
  credential: string;
}

function toRows(servers: IceServer[]): Row[] {
  return servers.map((s) => ({
    urls: Array.isArray(s.urls) ? s.urls.join(', ') : s.urls,
    username: s.username ?? '',
    credential: s.credential ?? '',
  }));
}

function toServers(rows: Row[]): IceServer[] {
  return rows
    .map((r) => {
      const urls = r.urls
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      const server: IceServer = { urls: urls.length === 1 ? urls[0]! : urls };
      if (r.username.trim()) server.username = r.username.trim();
      if (r.credential.trim()) server.credential = r.credential.trim();
      return server;
    })
    .filter((s) => (Array.isArray(s.urls) ? s.urls.length : s.urls.length > 0));
}

export function IceSettingsModal({ onClose }: { onClose: () => void }) {
  const { customIceServers, effectiveIceServers, saveIceServers, resetIceServers } = useSettings();
  const [rows, setRows] = useState<Row[]>(() =>
    toRows(customIceServers ?? effectiveIceServers),
  );

  const usingCustom = customIceServers != null && customIceServers.length > 0;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows((prev) => [...prev, { urls: '', username: '', credential: '' }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const save = () => {
    saveIceServers(toServers(rows));
    onClose();
  };

  const reset = () => {
    resetIceServers();
    setRows(toRows(effectiveIceServers));
  };

  return (
    <Modal
      onClose={onClose}
      banner={
        <>
          Connection servers {usingCustom ? '· custom' : '· defaults'}
        </>
      }
    >
      <div className="modal__body">
        <p className="modal__lede">
          STUN helps devices find a direct path; TURN relays traffic only when a
          direct connection isn&apos;t possible. Your servers are stored on this
          device and override the defaults.
        </p>

        <div className="ice-list">
          {rows.map((row, i) => (
            <div className="ice-row" key={i}>
              <div className="ice-row__head">
                <span className="ice-row__n">Server {i + 1}</span>
                <IconButton label="Remove server" onClick={() => removeRow(i)} className="ice-row__del">
                  <Trash2 size={15} />
                </IconButton>
              </div>
              <input
                className="input input--mono"
                placeholder="stun:host:3478  or  turn:host:3478"
                value={row.urls}
                onChange={(e) => setRow(i, { urls: e.target.value })}
              />
              <div className="ice-row__pair">
                <input
                  className="input"
                  placeholder="TURN username (optional)"
                  value={row.username}
                  onChange={(e) => setRow(i, { username: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="TURN credential (optional)"
                  value={row.credential}
                  onChange={(e) => setRow(i, { credential: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        <Button block onClick={addRow} className="ice-add">
          <Plus size={16} /> Add a server
        </Button>
      </div>

      <div className="modal__footer">
        <Button onClick={reset} title="Restore built-in defaults">
          <RotateCcw size={15} /> Reset
        </Button>
        <Button onClick={onClose}>
          <X size={15} /> Cancel
        </Button>
        <Button variant="yellow" onClick={save} block>
          Save
        </Button>
      </div>
    </Modal>
  );
}
