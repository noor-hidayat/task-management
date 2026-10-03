"use client"

import * as React from "react"
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/* ─── DataTableColumnHeader ────────────────────────────────────────── */
/* Sortable column header with icon indicator                          */

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-3 h-8 data-[state=open]:bg-accent ${className ?? ""}`}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{title}</span>
      {column.getIsSorted() === "desc" ? (
        <ChevronDown className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "asc" ? (
        <ChevronUp className="ml-2 h-4 w-4" />
      ) : (
        <ChevronsUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  )
}

/* ─── DataTable ────────────────────────────────────────────────────── */
/* Full data table with sorting & pagination                           */

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  /** Optional toolbar rendered above the table (filters, search, etc.) */
  toolbar?: React.ReactNode
  /** Optional footer content below the table */
  footer?: React.ReactNode
  /** Hide the built-in pagination footer */
  hidePagination?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 10,
  toolbar,
  footer,
  hidePagination = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize } },
  })

  return (
    <div className="space-y-4">
      {toolbar ? <div className="w-full">{toolbar}</div> : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        {/* overflow-x-auto: tabel lebar tetap bisa digeser di layar sempit */}
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/40">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="px-4 whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Tidak ada data ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {footer ? (
          <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>

      {hidePagination ? null : (
        <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Rows per page</p>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {[10, 20, 30, 40, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
