import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DetectionCenter } from './views/DetectionCenter';
import { InvestigationWorkspace } from './views/InvestigationWorkspace';
import { AdminPortal } from './views/AdminPortal';
import { SenderView } from './views/SenderView';
import { ReceiverView } from './views/ReceiverView';
import { LoginView } from './views/LoginView';

function getInitialView() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/sender' || hash === '#sender') return 'sender';
  if (path === '/receiver' || hash === '#receiver') return 'receiver';
  if (path === '/admin' || hash === '#admin') return 'admin';
  if (path === '/investigation' || hash === '#investigation') return 'investigation';
  return 'detection';
}

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState(getInitialView);
  const [selectedTransactionId, setSelectedTransactionId] = useState('TX-WORKED-5001');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveView(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (view) => {
    setActiveView(view);
    const targetPath = view === 'detection' ? '/' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Initializing FraudShield Terminal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleSelectTransaction = (txnId) => {
    setSelectedTransactionId(txnId);
    handleNavigate('investigation');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Top Navbar */}
      <Navbar 
        activeView={activeView} 
        setActiveView={handleNavigate}
        onSelectTransaction={handleSelectTransaction}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Navigation Sidebar */}
        <Sidebar 
          activeView={activeView} 
          setActiveView={handleNavigate} 
        />

        {/* Content View Container */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeView === 'detection' && (
            <DetectionCenter 
              onSelectTransaction={handleSelectTransaction}
            />
          )}

          {activeView === 'sender' && (
            <SenderView 
              onSelectTransaction={handleSelectTransaction}
            />
          )}

          {activeView === 'receiver' && (
            <ReceiverView 
              onSelectTransaction={handleSelectTransaction}
            />
          )}

          {activeView === 'investigation' && (
            <InvestigationWorkspace 
              selectedTransactionId={selectedTransactionId}
              onBack={() => handleNavigate('detection')}
            />
          )}

          {activeView === 'admin' && (
            <AdminPortal />
          )}
        </main>

      </div>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}
