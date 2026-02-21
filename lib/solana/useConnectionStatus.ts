/**
 * WebSocket Connection Status Hook
 *
 * Monitors the Solana connection health via periodic RPC getSlot() calls.
 * Does NOT create its own WebSocket subscription to avoid conflicts
 * with the event listener system.
 *
 * Status: connected | disconnected | reconnecting
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import type { ConnectionStatus } from "./gameTypes";

const HEALTH_CHECK_INTERVAL = 15_000; // 15 seconds

export function useConnectionStatus() {
  const { connection } = useConnection();
  const [status, setStatus] = useState<ConnectionStatus>("connected");
  const failCountRef = useRef(0);

  useEffect(() => {
    // Initial check
    connection
      .getSlot()
      .then(() => {
        setStatus("connected");
        failCountRef.current = 0;
      })
      .catch(() => {
        setStatus("disconnected");
        failCountRef.current = 1;
      });

    // Periodic health check — just ping the RPC
    const interval = setInterval(() => {
      connection
        .getSlot()
        .then(() => {
          if (failCountRef.current > 0) {
            console.log("[WS][Health] Connection restored");
          }
          failCountRef.current = 0;
          setStatus("connected");
        })
        .catch(() => {
          failCountRef.current += 1;
          if (failCountRef.current >= 2) {
            setStatus("disconnected");
            console.warn("[WS][Health] Connection lost — RPC unreachable");
          } else {
            setStatus("reconnecting");
          }
        });
    }, HEALTH_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [connection]);

  return { status };
}
