"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  Warehouse,
  AlertTriangle,
} from "lucide-react";

type StockEntry = {
  warehouseId: string;
  warehouseName: string;
  location: string;
  available: number;
  total: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: StockEntry[];
};

export default function HomePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reserving, setReserving] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
  const [selectedAvailability, setSelectedAvailability] =
    useState("ALL");

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");

      if (!res.ok) {
        throw new Error("Failed to load inventory");
      }

      const data = await res.json();
      setProducts(data);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleReserve(
    productId: string,
    warehouseId: string
  ) {
    const key = `${productId}:${warehouseId}`;

    setReserving(key);
    setReserveError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reserve-${productId}-${warehouseId}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setReserveError(
          "This unit was reserved by another user just now."
        );

        await loadProducts();
        setTimeout(() => {
         setReserveError(null);
        }, 5000);

        return;
      }

      if (res.status === 503) {
        setReserveError(
          "Inventory is currently being updated. Please retry in a moment."
        );
        
        setTimeout(() => {
         setReserveError(null);
        }, 5000);

        return;
      }

      if (!res.ok) {
        setReserveError(
          data.error ?? "Failed to create reservation"
        );

        setTimeout(() => {
          setReserveError(null);
        }, 5000);

        return;
      }

      await loadProducts();
      router.push(`/reservation/${data.id}`);
    } catch {
      setReserveError(
        "Network error. Please check your connection."
      );

      setTimeout(() => {
       setReserveError(null);
      }, 5000);

    } finally {
      setReserving(null);
    }
  }

  const warehouseOptions = useMemo(() => {
    const map = new Map();

    products.forEach((product) => {
      product.stock.forEach((stock) => {
        map.set(stock.warehouseId, {
          id: stock.warehouseId,
          name: stock.warehouseName,
        });
      });
    });

    return Array.from(map.values());
  }, [products]);

  const totalAvailableUnits = products.reduce(
    (acc, product) =>
      acc +
      product.stock.reduce(
        (sum, stock) => sum + stock.available,
        0
      ),
    0
  );

  const lowStockCount = products.filter((product) =>
    product.stock.some(
      (stock) =>
        stock.available > 0 && stock.available <= 3
    )
  ).length;

  const filteredProducts = products
    .map((product) => {
      const filteredStock = product.stock.filter((stock) => {
        const warehouseMatch =
          selectedWarehouse === "ALL" ||
          stock.warehouseId === selectedWarehouse;

        const availabilityMatch =
          selectedAvailability === "ALL" ||
          (selectedAvailability === "IN_STOCK" &&
            stock.available > 0) ||
          (selectedAvailability === "LOW_STOCK" &&
            stock.available > 0 &&
            stock.available <= 3) ||
          (selectedAvailability === "OUT_OF_STOCK" &&
            stock.available === 0);

        return warehouseMatch && availabilityMatch;
      });

      return {
        ...product,
        stock: filteredStock,
      };
    })
    .filter((product) => {
      const searchMatch =
        product.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        product.description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      return searchMatch && product.stock.length > 0;
    });

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-100" />
        </div>

        {/* Metrics Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200" />

                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-7 w-16 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cards Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="space-y-3">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
              </div>

              <div className="mt-6 space-y-4">
                {[1, 2].map((stock) => (
                  <div
                    key={stock}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="space-y-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                      <div className="h-2 w-full animate-pulse rounded bg-slate-200" />

                      <div className="flex items-center justify-between">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />

                        <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
}

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">
          Inventory Dashboard
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Monitor live inventory availability and reserve
          stock safely.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Package className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Available Units
              </p>

              <h2 className="mt-1 text-3xl font-bold text-slate-900">
                {totalAvailableUnits}
              </h2>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Warehouse className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Warehouses
              </p>

              <h2 className="mt-1 text-3xl font-bold text-slate-900">
                {warehouseOptions.length}
              </h2>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Low Stock Alerts
              </p>

              <h2 className="mt-1 text-3xl font-bold text-slate-900">
                {lowStockCount}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />

            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:bg-white"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedWarehouse}
              onChange={(e) =>
                setSelectedWarehouse(e.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500"
            >
              <option value="ALL">All Warehouses</option>

              {warehouseOptions.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.id}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              value={selectedAvailability}
              onChange={(e) =>
                setSelectedAvailability(e.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500"
            >
              <option value="ALL">All Stock</option>
              <option value="IN_STOCK">
                In Stock
              </option>
              <option value="LOW_STOCK">
                Low Stock
              </option>
              <option value="OUT_OF_STOCK">
                Out of Stock
              </option>
            </select>

            {(searchTerm !== "" ||
              selectedWarehouse !== "ALL" ||
              selectedAvailability !== "ALL") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedWarehouse("ALL");
                  setSelectedAvailability("ALL");
                }}
                className="text-sm font-medium text-rose-500 hover:text-rose-600"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {reserveError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <p className="font-medium">
              Reservation request failed
            </p>

            <p className="mt-1 text-rose-600">
              {reserveError}
            </p>
          </div>
        </div>
      )}

      {/* Empty */}
      {filteredProducts.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Package className="h-8 w-8 text-slate-400" />
          </div>

          <h3 className="mt-5 text-lg font-semibold text-slate-900">
            No matching inventory found
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Try adjusting your search query or inventory filters.
          </p>

          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedWarehouse("ALL");
              setSelectedAvailability("ALL");
            }}
            className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Products */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {product.name}
                </h2>

                {product.description && (
                  <p className="mt-2 text-sm text-slate-500">
                    {product.description}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-teal-600">
                  ₹{product.price.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {product.stock.map((stock) => {
                const key = `${product.id}:${stock.warehouseId}`;

                const isLoading =
                  reserving === key;

                const stockPercentage =
                  stock.total === 0
                    ? 0
                    : (stock.available / stock.total) * 100;

                const isLow =
                  stock.available > 0 &&
                  stock.available <= 3;

                const isOut =
                  stock.available === 0;

                return (
                  <div
                    key={stock.warehouseId}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-800">
                          {stock.warehouseName}
                        </h3>

                        <p className="text-xs text-slate-400">
                          {stock.location}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          isOut
                            ? "bg-red-100 text-red-600"
                            : isLow
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {isOut
                          ? "Out"
                          : isLow
                          ? "Low"
                          : "Available"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        style={{
                          width: `${stockPercentage}%`,
                        }}
                        className={`h-full rounded-full ${
                          isOut
                            ? "bg-red-400"
                            : isLow
                            ? "bg-amber-500"
                            : "bg-teal-500"
                        }`}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {stock.available}
                        </span>{" "}
                        available / {stock.total} total
                      </div>

                      <button
                        onClick={() =>
                          handleReserve(
                            product.id,
                            stock.warehouseId
                          )
                        }
                        disabled={
                          stock.available === 0 ||
                          isLoading
                        }
                        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Reserving...
                          </span>
                        ) : (
                          "Reserve"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}