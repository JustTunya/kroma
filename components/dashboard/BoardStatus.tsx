"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ConnectionState = "live" | "reconnecting" | "offline";

export type BoardStatus = {
  /** Null means no board is mounted — the unlock screen, for instance. */
  connection: ConnectionState | null;
  /** The last time data was known good. What OFFLINE puts on screen. */
  freshAt: Date;
};

type Store = BoardStatus & {
  report: (next: Partial<BoardStatus>) => void;
};

const BoardStatusContext = createContext<Store | null>(null);

const IDLE: BoardStatus = { connection: null, freshAt: new Date(0) };

/**
 * The connection pill lives in the header (a layout) and the socket lives in
 * the board (a page). React context does not cross that boundary on its own,
 * so the layout wraps both in this provider and the board reports upward.
 *
 * `children` is passed as a prop, so a connection change re-renders the pill
 * and not the board beneath it.
 */
export function BoardStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BoardStatus>(IDLE);

  const report = useCallback(
    (next: Partial<BoardStatus>) => setStatus((prev) => ({ ...prev, ...next })),
    [],
  );

  const value = useMemo(() => ({ ...status, report }), [status, report]);

  return (
    <BoardStatusContext.Provider value={value}>
      {children}
    </BoardStatusContext.Provider>
  );
}

/** `connection: null` on any screen with no board, so the pill can stay away. */
export function useBoardStatus(): BoardStatus {
  return useContext(BoardStatusContext) ?? IDLE;
}

export function useReportBoardStatus(): Store["report"] {
  return useContext(BoardStatusContext)?.report ?? noop;
}

function noop() {}
