"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

type Reservation = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
};

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds remaining

  // fetch the reservation — we also poll every few seconds to catch server-side expiry
  const loadReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) {
        setError("Reservation not found");
        return;
      }
      const data: Reservation = await res.json();
      setReservation(data);

      const remaining = Math.max(
        0,
        Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
    } catch {
      setError("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReservation();
  }, [loadReservation]);

  // tick the countdown every second
  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // reservation expired on the client — reload to get server state
          loadReservation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation, loadReservation]);

  async function handleConfirm() {
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 410) {
        setActionError("This reservation has expired. The stock has been released.");
        setReservation((prev) => prev ? { ...prev, status: "RELEASED" } : prev);
        return;
      }

      if (!res.ok) {
        setActionError(data.error ?? "Could not confirm");
        return;
      }

      setReservation(data);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Could not cancel");
        return;
      }

      setReservation(data);
    } finally {
      setActionLoading(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  if (loading) {
    return (
      <div className="text-gray-500 text-sm mt-10 text-center">
        Loading reservation...
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mt-8">
        {error ?? "Reservation not found"}
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isExpired = isPending && timeLeft === 0;

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={() => router.push("/")}
        className="text-sm text-indigo-600 hover:underline mb-6 inline-block"
      >
        &larr; Back to products
      </button>

      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Reservation</h1>
          <StatusBadge status={isExpired ? "EXPIRED" : reservation.status} />
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-6">
          <p>
            <span className="text-gray-400">Reservation ID:</span>{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
              {reservation.id}
            </code>
          </p>
          <p>
            <span className="text-gray-400">Quantity:</span>{" "}
            {reservation.quantity} unit(s)
          </p>
          <p>
            <span className="text-gray-400">Expires at:</span>{" "}
            {new Date(reservation.expiresAt).toLocaleTimeString()}
          </p>
        </div>

        {/* countdown — only shown while pending and not yet expired */}
        {isPending && !isExpired && (
          <div
            className={`rounded-md p-4 mb-5 text-center ${
              timeLeft < 60 ? "bg-red-50 border border-red-200" : "bg-indigo-50"
            }`}
          >
            <p className="text-xs text-gray-500 mb-1">Time remaining</p>
            <p
              className={`text-3xl font-mono font-bold ${
                timeLeft < 60 ? "text-red-600" : "text-indigo-700"
              }`}
            >
              {formatTime(timeLeft)}
            </p>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 mb-5 text-sm">
            This reservation has expired. The held stock has been returned to
            inventory.
          </div>
        )}

        {isConfirmed && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-md p-3 mb-5 text-sm">
            Payment confirmed! Your order has been placed.
          </div>
        )}

        {isReleased && !isExpired && (
          <div className="bg-gray-50 border border-gray-200 text-gray-600 rounded-md p-3 mb-5 text-sm">
            This reservation was cancelled. Stock has been returned.
          </div>
        )}

        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 mb-4 text-sm">
            {actionError}
          </div>
        )}

        {isPending && !isExpired && (
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="flex-1 bg-indigo-600 text-white font-medium py-2 rounded-md text-sm
                hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
            >
              {actionLoading ? "Processing..." : "Confirm purchase"}
            </button>
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-md
                text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {(isConfirmed || isReleased || isExpired) && (
          <button
            onClick={() => router.push("/")}
            className="w-full border border-gray-300 text-gray-700 py-2 rounded-md text-sm
              hover:bg-gray-50 transition-colors"
          >
            Back to products
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-green-100 text-green-800",
    RELEASED: "bg-gray-100 text-gray-600",
    EXPIRED: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        styles[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}
