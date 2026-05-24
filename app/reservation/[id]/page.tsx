"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Package,
} from "lucide-react";

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
  const [timeLeft, setTimeLeft] = useState<number>(0);

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
        Math.floor(
          (new Date(data.expiresAt).getTime() - Date.now()) / 1000
        )
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

  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
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
        setActionError(
          "This reservation has expired. The stock has been released."
        );

        setReservation((prev) =>
          prev ? { ...prev, status: "RELEASED" } : prev
        );

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
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");

    const s = (seconds % 60)
      .toString()
      .padStart(2, "0");

    return `${m}:${s}`;
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600 mb-4" />

        <p className="text-sm font-medium text-slate-500">
          Loading reservation details...
        </p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to inventory
        </button>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />

          <h3 className="mt-3 text-base font-semibold text-rose-950">
            Reservation Not Found
          </h3>

          <p className="mt-1 text-sm text-rose-700">
            The reservation may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isExpired = isPending && timeLeft === 0;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
      <button
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to inventory
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Reservation Details
            </h1>

            <p className="text-xs text-slate-400 font-mono mt-1">
              ID: {reservation.id}
            </p>
          </div>

          <StatusBadge
            status={isExpired ? "EXPIRED" : reservation.status}
          />
        </div>

        <div className="p-6">
          <div className="rounded-xl bg-teal-50 border border-teal-100 p-4 flex gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Active Reservation
              </p>

              <h2 className="font-semibold text-slate-900 mt-1">
                Reserved Inventory Unit
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Your selected inventory is temporarily locked until
                confirmation or expiry.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-5 text-sm mb-6">
            <div>
              <span className="text-slate-400 text-xs">
                Reservation ID
              </span>

              <div className="mt-1">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                  {reservation.id}
                </code>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-xs">
                Quantity
              </span>

              <p className="font-medium text-slate-800 mt-1">
                {reservation.quantity} unit(s)
              </p>
            </div>

            <div>
              <span className="text-slate-400 text-xs">
                Created At
              </span>

              <p className="font-medium text-slate-800 mt-1">
                {new Date(
                  reservation.createdAt
                ).toLocaleTimeString()}
              </p>
            </div>

            <div>
              <span className="text-slate-400 text-xs">
                Expires At
              </span>

              <p className="font-medium text-slate-800 mt-1">
                {new Date(
                  reservation.expiresAt
                ).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {isPending && !isExpired && (
            <div
              className={`rounded-2xl border p-5 mb-6 text-center ${
                timeLeft < 60
                  ? "bg-rose-50 border-rose-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-600" />

                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  Reservation Countdown
                </p>
              </div>

              <p
                className={`text-5xl font-mono font-bold tracking-tight transition-all duration-300 ${
                  timeLeft < 60
                    ? "text-rose-600"
                    : "text-amber-600"
                }`}
              >
                {formatTime(timeLeft)}
              </p>

              <p className="text-xs text-slate-500 mt-3">
                Your stock will automatically return to inventory after
                expiry.
              </p>
            </div>
          )}

          {isExpired && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm flex items-start gap-2">
              This reservation has expired. The held stock has been
              returned to inventory.
            </div>
          )}

          {isConfirmed && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />

              <div>
                <p className="font-semibold">
                  Payment confirmed successfully
                </p>

                <p className="mt-1 text-green-700/90">
                  Your order has been placed and inventory has been
                  allocated.
                </p>
              </div>
            </div>
          )}

          {isReleased && !isExpired && (
            <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl p-4 mb-5 text-sm">
              This reservation was cancelled. Stock has been returned
              to inventory.
            </div>
          )}

          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm flex items-start gap-2">
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </>
            </div>
          )}

          {isPending && !isExpired && (
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg text-sm
                hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all"
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Confirm purchase"
                )}
              </button>

              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 border border-slate-300 bg-white text-slate-700 font-semibold py-2.5 rounded-lg
                text-sm hover:bg-slate-50 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {(isConfirmed || isReleased || isExpired) && (
            <button
              onClick={() => router.push("/")}
              className="w-full border border-slate-300 bg-white text-slate-700 py-2.5 rounded-lg text-sm
              hover:bg-slate-50 transition-all font-medium"
            >
              Back to products
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    CONFIRMED:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    RELEASED:
      "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    EXPIRED:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}