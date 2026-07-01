import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HomeScreen } from './components/screens/HomeScreen';
import { SendScreen } from './components/screens/SendScreen';
import { ReceiveScreen } from './components/screens/ReceiveScreen';
import { ChatScreen } from './components/screens/ChatScreen';
import { IncomingRequestModal } from './components/modals/IncomingRequestModal';
import { useSession } from './state/SessionProvider';

function NoticeToast() {
  const { lastNotice, clearNotice } = useSession();
  useEffect(() => {
    if (!lastNotice) return;
    const id = setTimeout(clearNotice, 4000);
    return () => clearTimeout(id);
  }, [lastNotice, clearNotice]);

  if (!lastNotice) return null;
  return (
    <div className="toast" role="status" onClick={clearNotice}>
      {lastNotice}
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/send" element={<SendScreen />} />
        <Route path="/receive" element={<ReceiveScreen />} />
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global: an incoming connection can arrive on any screen. */}
      <IncomingRequestModal />
      <NoticeToast />
    </>
  );
}
