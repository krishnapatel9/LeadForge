import React from "react";

export function SkeletonLeadCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-pulse space-y-3">
      <div className="flex justify-between items-center">
        <div className="h-3.5 bg-slate-200 rounded w-28"></div>
        <div className="h-4 bg-slate-200 rounded-full w-14"></div>
      </div>
      <div className="h-4 bg-slate-200 rounded w-36"></div>
      <div className="h-3 bg-slate-150 bg-slate-200/70 rounded w-24"></div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
        <div className="h-3 bg-slate-200 rounded w-16"></div>
        <div className="h-3 bg-slate-200 rounded w-14"></div>
      </div>
    </div>
  );
}

export function SkeletonColumn() {
  return (
    <div className="w-80 flex flex-col shrink-0 space-y-3">
      <div className="flex justify-between items-center mb-1">
        <div className="h-4 bg-slate-200 rounded w-24 animate-pulse"></div>
        <div className="h-4 bg-slate-200 rounded-full w-6 animate-pulse"></div>
      </div>
      <SkeletonLeadCard />
      <SkeletonLeadCard />
      <SkeletonLeadCard />
    </div>
  );
}

export function SkeletonDetailPanel() {
  return (
    <div className="p-6 space-y-6 animate-pulse bg-white border border-slate-200 rounded-xl">
      <div className="space-y-2">
        <div className="h-5 bg-slate-200 rounded w-48"></div>
        <div className="h-4 bg-slate-200 rounded w-32"></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 bg-slate-100 rounded-lg"></div>
        <div className="h-16 bg-slate-100 rounded-lg"></div>
        <div className="h-16 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-28"></div>
        <div className="h-20 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-36"></div>
        <div className="h-32 bg-slate-100 rounded-lg"></div>
      </div>
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      <td className="px-6 py-4">
        <div className="h-4 bg-slate-200 rounded w-32"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-slate-200 rounded w-40"></div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="h-4 bg-slate-200 rounded w-12 mx-auto"></div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="h-4 bg-slate-200 rounded w-12 mx-auto"></div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="h-4 bg-slate-200 rounded w-12 mx-auto"></div>
      </td>
      <td className="px-6 py-4 text-center">
        <div className="h-6 bg-slate-200 rounded-full w-16 mx-auto"></div>
      </td>
    </tr>
  );
}
