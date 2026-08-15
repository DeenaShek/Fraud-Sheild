import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [simulatorStatus, setSimulatorStatus] = useState({ isRunning: false, intervalMs: 3000, totalEmitted: 0, totalAlerts: 0 });
  const [latestCriticalAlert, setLatestCriticalAlert] = useState(null);

  useEffect(() => {
    let sInstance = null;
    let eventSource = null;

    // 1. Try Socket.io
    try {
      const socketUrl = window.location.origin;
      sInstance = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 4000
      });

      sInstance.on('connect', () => {
        setIsConnected(true);
      });

      sInstance.on('disconnect', () => {
        setIsConnected(false);
      });

      sInstance.on('simulator_status', (status) => {
        setSimulatorStatus(status);
      });

      sInstance.on('new_transaction', (txn) => {
        setLiveTransactions(prev => [txn, ...prev.slice(0, 49)]);
      });

      sInstance.on('new_alert', (alert) => {
        setLiveAlerts(prev => [alert, ...prev.slice(0, 49)]);
        if (alert.riskBand === 'CRITICAL') {
          setLatestCriticalAlert(alert);
        }
      });

      setSocket(sInstance);
    } catch (err) {
      console.warn('[SocketContext] Socket.io init bypassed:', err);
    }

    // 2. Native SSE Fallback (connects to nativeServer.js /api/transactions/stream)
    try {
      eventSource = new EventSource('/api/transactions/stream');
      eventSource.onopen = () => setIsConnected(true);
      eventSource.onerror = () => {
        // SSE error, gracefully stay quiet
      };
      eventSource.addEventListener('TRANSACTION', (e) => {
        try {
          const txn = JSON.parse(e.data);
          setLiveTransactions(prev => [txn, ...prev.slice(0, 49)]);
        } catch {}
      });
      eventSource.addEventListener('ALERT', (e) => {
        try {
          const alert = JSON.parse(e.data);
          setLiveAlerts(prev => [alert, ...prev.slice(0, 49)]);
          if (alert.riskBand === 'CRITICAL') {
            setLatestCriticalAlert(alert);
          }
        } catch {}
      });
      eventSource.addEventListener('SIMULATOR_STATUS', (e) => {
        try {
          const status = JSON.parse(e.data);
          setSimulatorStatus(status);
        } catch {}
      });
    } catch (sseErr) {
      console.warn('[SocketContext] SSE fallback bypassed:', sseErr);
    }

    return () => {
      if (sInstance) sInstance.disconnect();
      if (eventSource) eventSource.close();
    };
  }, []);

  const dismissCriticalAlert = () => setLatestCriticalAlert(null);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      liveTransactions,
      liveAlerts,
      simulatorStatus,
      latestCriticalAlert,
      dismissCriticalAlert
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
