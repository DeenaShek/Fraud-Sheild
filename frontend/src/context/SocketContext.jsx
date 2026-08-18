import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(true);
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [simulatorStatus, setSimulatorStatus] = useState({ isRunning: false, intervalMs: 3000, totalEmitted: 0, totalAlerts: 0 });
  const [latestCriticalAlert, setLatestCriticalAlert] = useState(null);

  // Unified listeners map for cross-component subscription (e.g. socket.on('payment_settled'))
  const eventListenersRef = useRef(new Map());

  // Socket shim object to guarantee .on / .off works seamlessly with SSE or Socket.IO
  const [socketShim, setSocketShim] = useState(() => ({
    on: (event, callback) => {
      if (!eventListenersRef.current.has(event)) {
        eventListenersRef.current.set(event, new Set());
      }
      eventListenersRef.current.get(event).add(callback);
    },
    off: (event, callback) => {
      if (eventListenersRef.current.has(event)) {
        if (callback) {
          eventListenersRef.current.get(event).delete(callback);
        } else {
          eventListenersRef.current.delete(event);
        }
      }
    },
    emit: (event, data) => {
      // Local emit for mock/direct dispatch if needed
    }
  }));

  const dispatchCustomEvent = (eventName, data) => {
    if (eventListenersRef.current.has(eventName)) {
      eventListenersRef.current.get(eventName).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for ${eventName}:`, err);
        }
      });
    }
  };

  useEffect(() => {
    let sInstance = null;
    let eventSource = null;

    // 1. Try Socket.io (if backend runs with socket.io support)
    try {
      const socketUrl = window.location.origin;
      sInstance = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        timeout: 3000
      });

      sInstance.on('connect', () => {
        setIsConnected(true);
      });

      sInstance.on('disconnect', () => {
        setIsConnected(false);
      });

      sInstance.on('simulator_status', (status) => {
        setSimulatorStatus(status);
        dispatchCustomEvent('simulator_status', status);
      });

      sInstance.on('new_transaction', (txn) => {
        setLiveTransactions(prev => [txn, ...prev.slice(0, 49)]);
        dispatchCustomEvent('new_transaction', txn);
      });

      sInstance.on('new_alert', (alert) => {
        setLiveAlerts(prev => [alert, ...prev.slice(0, 49)]);
        if (alert.riskBand === 'CRITICAL') {
          setLatestCriticalAlert(alert);
        }
        dispatchCustomEvent('new_alert', alert);
      });

      sInstance.on('payment_settled', (data) => {
        dispatchCustomEvent('payment_settled', data);
      });

      sInstance.on('payment_held', (data) => {
        dispatchCustomEvent('payment_held', data);
      });

      sInstance.on('investigation_resolved', (data) => {
        dispatchCustomEvent('investigation_resolved', data);
      });

      // Wrap socket with our listener bridge so custom subscriptions also receive SSE
      setSocketShim({
        on: (event, callback) => {
          if (!eventListenersRef.current.has(event)) {
            eventListenersRef.current.set(event, new Set());
          }
          eventListenersRef.current.get(event).add(callback);
          try {
            sInstance.on(event, callback);
          } catch {}
        },
        off: (event, callback) => {
          if (eventListenersRef.current.has(event)) {
            if (callback) {
              eventListenersRef.current.get(event).delete(callback);
            } else {
              eventListenersRef.current.delete(event);
            }
          }
          try {
            sInstance.off(event, callback);
          } catch {}
        },
        emit: (event, data) => {
          try {
            sInstance.emit(event, data);
          } catch {}
        }
      });
    } catch (err) {
      console.warn('[SocketContext] Socket.io init bypassed:', err);
    }

    // 2. Native Server-Sent Events (SSE) Stream
    try {
      eventSource = new EventSource('/api/transactions/stream');
      eventSource.onopen = () => setIsConnected(true);
      eventSource.onerror = () => {
        // SSE error / reconnecting
      };

      const handleTransactionEvent = (e) => {
        try {
          const txn = JSON.parse(e.data);
          setLiveTransactions(prev => [txn, ...prev.slice(0, 49)]);
          dispatchCustomEvent('new_transaction', txn);
          dispatchCustomEvent('TRANSACTION', txn);
        } catch {}
      };

      const handleAlertEvent = (e) => {
        try {
          const alert = JSON.parse(e.data);
          setLiveAlerts(prev => [alert, ...prev.slice(0, 49)]);
          if (alert.riskBand === 'CRITICAL') {
            setLatestCriticalAlert(alert);
          }
          dispatchCustomEvent('new_alert', alert);
          dispatchCustomEvent('ALERT', alert);
        } catch {}
      };

      const handleSimulatorStatusEvent = (e) => {
        try {
          const status = JSON.parse(e.data);
          setSimulatorStatus(status);
          dispatchCustomEvent('simulator_status', status);
          dispatchCustomEvent('SIMULATOR_STATUS', status);
        } catch {}
      };

      const handlePaymentSettledEvent = (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatchCustomEvent('payment_settled', data);
        } catch {}
      };

      const handlePaymentHeldEvent = (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatchCustomEvent('payment_held', data);
        } catch {}
      };

      const handleInvestigationResolvedEvent = (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatchCustomEvent('investigation_resolved', data);
        } catch {}
      };

      // Listen for both lowercase standard and uppercase aliases
      eventSource.addEventListener('new_transaction', handleTransactionEvent);
      eventSource.addEventListener('TRANSACTION', handleTransactionEvent);
      eventSource.addEventListener('new_alert', handleAlertEvent);
      eventSource.addEventListener('ALERT', handleAlertEvent);
      eventSource.addEventListener('simulator_status', handleSimulatorStatusEvent);
      eventSource.addEventListener('SIMULATOR_STATUS', handleSimulatorStatusEvent);
      eventSource.addEventListener('payment_settled', handlePaymentSettledEvent);
      eventSource.addEventListener('payment_held', handlePaymentHeldEvent);
      eventSource.addEventListener('investigation_resolved', handleInvestigationResolvedEvent);
    } catch (sseErr) {
      console.warn('[SocketContext] SSE connection bypassed:', sseErr);
    }

    return () => {
      if (sInstance) sInstance.disconnect();
      if (eventSource) eventSource.close();
    };
  }, []);

  const dismissCriticalAlert = () => setLatestCriticalAlert(null);

  return (
    <SocketContext.Provider value={{
      socket: socketShim,
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
