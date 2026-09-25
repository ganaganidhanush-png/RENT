'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, IndianRupee, CalendarClock, ArrowUpRight, Plus, 
  ShieldCheck, CheckCircle2, Edit3, FileText, AlertTriangle, 
  Phone, MessageSquare, Clock, Users, ArrowRight, Wallet, Check, AlertCircle
} from 'lucide-react';
import { Room, Payment, Tenant } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';
import { 
  getLocalRooms, getLocalTenants, getLocalPayments, 
  mergeTenants, mergeRooms, getLandlordProfile,
  getTenantAdvanceSummary, AdvanceTrackingSummary
} from '@/lib/store/app-store';
import RecordPaymentModal from '@/components/payments/record-payment-modal';
import AdvanceDepositModal from '@/components/tenants/advance-deposit-modal';

interface DashboardProps {
  rooms: Room[];
  recentPayments: Payment[];
  expiringTenants: Tenant[];
  allTenants?: Tenant[];
  stats: {
    occupiedRooms: number;
    totalRooms: number;
    totalRentCollected: number;
    totalRentExpected: number;
    pendingDues: number;
    expiriesCount: number;
  };
}

export interface UnpaidTenantRecord {
  tenant: Tenant;
  room?: Room | null;
  expectedRent: number;
  rentPaidThisMonth: number;
  pendingDue: number;
  rentDueDay: number;
  dueDate: Date;
  graceLimitDate: Date;
  isOverdue: boolean;
  daysOverdue: number;
  daysRemaining: number;
  isPastDueDatePlus2: boolean;
  daysOverGraceLimit: number;
  status: 'NOT_PAID' | 'PARTIALLY_PAID';
  lastSliceNote?: string | null;
}

export default function DashboardView({ 
  rooms: initialRooms, 
  recentPayments: initialPayments, 
  expiringTenants: initialExpiring, 
  allTenants: initialAllTenants,
  stats: initialStats 
}: DashboardProps) {
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (typeof window !== 'undefined') {
      const local = getLocalTenants();
      if (local && local.length > 0) {
        return mergeTenants(local, initialAllTenants || []);
      }
    }
    return initialAllTenants && initialAllTenants.length > 0 ? initialAllTenants : [];
  });

  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      const local = getLocalRooms();
      if (local && local.length > 0) {
        return mergeRooms(local, initialRooms || []);
      }
    }
    return initialRooms && initialRooms.length > 0 ? initialRooms : DEFAULT_ROOMS;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    if (initialPayments && initialPayments.length > 0) return initialPayments;
    if (typeof window !== 'undefined') {
      return getLocalPayments();
    }
    return [];
  });

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [dashboardViewMode, setDashboardViewMode] = useState<'UNPAID_RENT' | 'ALL_TRANSACTIONS' | 'ADVANCE_DEPOSITS'>('UNPAID_RENT');
  const [unpaidFilter, setUnpaidFilter] = useState<'DUE_PLUS_2' | 'ALL_PENDING'>('DUE_PLUS_2');
  const [selectedTenantForAdvance, setSelectedTenantForAdvance] = useState<{
    tenant: Tenant;
    room?: Room | null;
    summary: AdvanceTrackingSummary;
  } | null>(null);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);

  // Live synchronization across all open pages & tabs
  useEffect(() => {
    const syncData = () => {
      const localT = getLocalTenants();
      const localR = getLocalRooms();
      const localP = getLocalPayments();
      const mergedT = mergeTenants(localT, initialAllTenants || []);
      const mergedR = mergeRooms(localR, initialRooms || [], mergedT);
      setTenants(mergedT);
      setRooms(mergedR);
      setPayments(localP);
    };

    syncData();
    window.addEventListener('rentvault_data_updated', syncData);
    return () => window.removeEventListener('rentvault_data_updated', syncData);
  }, [initialAllTenants, initialRooms]);

  // Current month reference
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const currentYearMonth = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
  const currentMonthFullName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const currentMonthShort = now.toLocaleString('en-IN', { month: 'short' });
  const currentMonthLongNameOnly = now.toLocaleString('en-IN', { month: 'long' });
  const currentDay = now.getDate();
  const todayStart = new Date(currentYear, currentMonthIndex, currentDay);

  const nextMonthDate = new Date(currentYear, currentMonthIndex + 1, 1);
  const nextMonthFullName = nextMonthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const totalRoomsCount = rooms.length > 0 ? rooms.length : 6;
  const occupiedRoomsCount = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const vacantRoomsCount = Math.max(0, totalRoomsCount - occupiedRoomsCount);
  const activeTenants = tenants.filter((t) => t.status !== 'MOVED_OUT');
  const bachelorsCount = activeTenants.filter((t) => t.tenant_type === 'BACHELORS').length;
  const familiesCount = activeTenants.filter((t) => t.tenant_type === 'FAMILY').length;

  // RULE: If a tenant came this month (or in future), their rent should be taken next month!
  const newTenantsThisMonth = activeTenants.filter((t) => {
    const moveInMonth = (t.move_in_date || '').slice(0, 7);
    return Boolean(moveInMonth && moveInMonth >= currentYearMonth);
  });

  // Only tenants who joined BEFORE the current month owe rent for this month
  const rentEligibleTenantsThisMonth = activeTenants.filter((t) => {
    const moveInMonth = (t.move_in_date || '').slice(0, 7);
    return !moveInMonth || moveInMonth < currentYearMonth;
  });

  // Unpaid Rent Calculation: Only rent-eligible active tenants
  const unpaidTenantsThisMonth: UnpaidTenantRecord[] = rentEligibleTenantsThisMonth
    .map((t) => {
      const room = rooms.find((r) => r.id === t.room_id || r.room_number === t.room?.room_number) || t.room;
      const expectedRent = Number(t.monthly_rent || room?.base_rent || 0);

      // Helper to accurately match rent payments for current month without cross-month leak
      const isCurrentMonthPayment = (p: Payment) => {
        const isRent = (p.payment_type || 'RENT') === 'RENT';
        if (!isRent) return false;

        const billingPeriod = (p.billing_period_month || '').slice(0, 7);
        if (billingPeriod) {
          return billingPeriod === currentYearMonth;
        }

        const billingName = (p.billing_month || '').toLowerCase();
        if (billingName) {
          const hasMonth = billingName.includes(currentMonthLongNameOnly.toLowerCase()) || billingName.includes(currentMonthShort.toLowerCase());
          const hasYear = billingName.includes(String(currentYear));
          if (hasMonth && hasYear) return true;
        }

        const payDateMonth = (p.payment_date || '').slice(0, 7);
        return payDateMonth === currentYearMonth;
      };

      // Filter rent payments matching this tenant and current month
      const tenantMonthRentPayments = payments
        .filter((p) => p.tenant_id === t.id && isCurrentMonthPayment(p))
        .sort((a, b) => new Date(b.payment_date || b.created_at || '').getTime() - new Date(a.payment_date || a.created_at || '').getTime());

      const rentPaidThisMonth = tenantMonthRentPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      const pendingDue = Math.max(0, expectedRent - rentPaidThisMonth);
      
      // Calculate effective due date without month spillover (e.g. day 31 in a 30-day month)
      const daysInCurrentMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
      const rentDueDay = t.rent_due_day || 5;
      const effectiveDueDay = Math.min(rentDueDay, daysInCurrentMonth);

      const dueDate = new Date(currentYear, currentMonthIndex, effectiveDueDay);
      const graceLimitDate = new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000);

      const isOverdue = todayStart > dueDate;
      const daysOverdue = isOverdue ? Math.max(1, Math.round((todayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const daysRemaining = !isOverdue ? Math.max(0, Math.round((dueDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))) : 0;

      const isPastDueDatePlus2 = todayStart >= graceLimitDate;
      const daysOverGraceLimit = isPastDueDatePlus2
        ? Math.max(0, Math.round((todayStart.getTime() - graceLimitDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const latestPayment = tenantMonthRentPayments[0];

      return {
        tenant: t,
        room,
        expectedRent,
        rentPaidThisMonth,
        pendingDue,
        rentDueDay,
        dueDate,
        graceLimitDate,
        isOverdue,
        daysOverdue,
        daysRemaining,
        isPastDueDatePlus2,
        daysOverGraceLimit,
        status: rentPaidThisMonth > 0 ? ('PARTIALLY_PAID' as const) : ('NOT_PAID' as const),
        lastSliceNote: latestPayment?.notes,
      };
    })
    .filter((record) => record.expectedRent > 0 && record.pendingDue > 0);

  // Tenants past due date + 2 days
  const unpaidTenantsPastDuePlus2 = unpaidTenantsThisMonth.filter((u) => u.isPastDueDatePlus2);
  const totalPendingRentPast2Days = unpaidTenantsPastDuePlus2.reduce((sum, u) => sum + u.pendingDue, 0);

  // List of displayed tenants according to active filter
  const displayedUnpaidTenants = unpaidFilter === 'DUE_PLUS_2' ? unpaidTenantsPastDuePlus2 : unpaidTenantsThisMonth;

  // Expected Total Rent: Only tenants eligible for rent this month are expected
  const totalRentExpected = (rentEligibleTenantsThisMonth.length > 0
    ? rentEligibleTenantsThisMonth.reduce((acc, t) => acc + Number(t.monthly_rent || 0), 0)
    : (activeTenants.length > 0 ? 0 : rooms.reduce((acc, r) => acc + (r.status === 'OCCUPIED' ? Number(r.base_rent) : 0), 0))) || initialStats.totalRentExpected;

  // Rent collected specifically for current month
  const totalRentCollectedThisMonth = payments.filter((p) => {
    const isRent = (p.payment_type || 'RENT') === 'RENT';
    if (!isRent) return false;
    const billingPeriod = (p.billing_period_month || '').slice(0, 7);
    if (billingPeriod) return billingPeriod === currentYearMonth;
    const billingName = (p.billing_month || '').toLowerCase();
    if (billingName) {
      const hasMonth = billingName.includes(currentMonthLongNameOnly.toLowerCase()) || billingName.includes(currentMonthShort.toLowerCase());
      const hasYear = billingName.includes(String(currentYear));
      if (hasMonth && hasYear) return true;
    }
    const payDateMonth = (p.payment_date || '').slice(0, 7);
    return payDateMonth === currentYearMonth;
  }).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

  // Rates for progress bars
  const collectionRate = totalRentExpected > 0 ? Math.min(100, Math.round((totalRentCollectedThisMonth / totalRentExpected) * 100)) : 0;
  const occupancyPercentage = totalRoomsCount > 0 ? Math.round((occupiedRoomsCount / totalRoomsCount) * 100) : 0;

  // Expiring agreements within the next 45 days
  const expiringSoonTenants = activeTenants.filter((t) => {
    if (!t.lease_end_date) return false;
    const end = new Date(t.lease_end_date);
    const diffDays = Math.ceil((end.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 45;
  });

  // One-Time Advance Deposit Tracker for Active Tenants
  const tenantAdvanceList = activeTenants.map((t) => {
    const room = rooms.find((r) => r.id === t.room_id || r.room_number === t.room?.room_number) || t.room;
    const summary = getTenantAdvanceSummary(t, room, payments);
    return {
      tenant: t,
      room,
      summary,
    };
  });

  const totalAgreedAdvance = tenantAdvanceList.reduce((sum, item) => sum + item.summary.agreedAdvance, 0);
  const totalCollectedAdvance = tenantAdvanceList.reduce((sum, item) => sum + item.summary.totalPaid, 0);
  const totalPendingAdvance = tenantAdvanceList.reduce((sum, item) => sum + item.summary.remainingUnpaid, 0);
  const fullyPaidAdvanceCount = tenantAdvanceList.filter((item) => item.summary.isFullyPaid).length;
  const partialAdvanceCount = tenantAdvanceList.filter((item) => item.summary.status === 'PARTIALLY_PAID').length;
  const unpaidAdvanceCount = tenantAdvanceList.filter((item) => item.summary.status === 'UNPAID').length;

  const handleRecordAdvancePiece = (tenant: Tenant, remaining: number) => {
    setIsAdvanceModalOpen(false);
    const roomObj = rooms.find((r) => r.id === tenant.room_id) || tenant.room || undefined;
    const now = new Date();
    const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthStr = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const agreedTotal = Number(tenant.security_deposit_paid || roomObj?.security_deposit || 20000);
    const profile = getLandlordProfile();
    const defaultReceiver = profile.name ? `${profile.name} (Owner)` : 'Landlord';
    setEditingPayment({
      id: `pay-advance-${Date.now()}`,
      tenant_id: tenant.id,
      room_id: tenant.room_id || '',
      payment_type: 'SECURITY_DEPOSIT',
      total_target_amount: agreedTotal,
      billing_period_month: currentMonthIso,
      billing_month: monthStr,
      amount_due: remaining,
      amount_paid: remaining,
      amount_pending: 0,
      payment_status: 'PAID',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'UPI',
      received_by: defaultReceiver,
      notes: `Advance Deposit Collection for ${tenant.full_name}`,
      created_at: new Date().toISOString(),
      tenant,
      room: roomObj,
    });
    setIsPaymentModalOpen(true);
  };

  const handleSendWhatsAppReminder = (u: UnpaidTenantRecord) => {
    const profile = getLandlordProfile();
    const graceDateStr = u.graceLimitDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const text = `*RENT PAYMENT NOTICE - ${profile.propertyName || 'RentVault Property'}*\n\n` +
      `Dear ${u.tenant.full_name},\n` +
      `This is a payment notice regarding your rent for *${currentMonthFullName}* (Room ${u.room?.room_number || ''}).\n\n` +
      `• Monthly Rent: ₹${u.expectedRent.toLocaleString('en-IN')}\n` +
      (u.rentPaidThisMonth > 0 ? `• Already Paid (Slice): ₹${u.rentPaidThisMonth.toLocaleString('en-IN')}\n` : '') +
      `• *Total Pending Due: ₹${u.pendingDue.toLocaleString('en-IN')}*\n` +
      `• Rent Due Date: ${u.rentDueDay}th ${currentMonthShort}\n` +
      (u.isPastDueDatePlus2 
        ? `• Status: *🚨 2-Day Grace Period Expired on ${graceDateStr} (${u.daysOverGraceLimit}d overdue)*\n\n` 
        : `• Status: Rent Pending\n\n`) +
      (profile.upiId ? `Please clear the payment immediately via UPI to: *${profile.upiId}*\n\n` : '') +
      `Kindly share the transaction receipt once paid. Thank you!`;

    const encoded = encodeURIComponent(text);
    const phone = u.tenant.phone ? u.tenant.phone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleQuickRecordRent = (u: UnpaidTenantRecord) => {
    const profile = getLandlordProfile();
    const defaultReceiver = profile.name ? `${profile.name} (Owner)` : 'Landlord';
    setEditingPayment({
      id: `pay-${Date.now()}`,
      tenant_id: u.tenant.id,
      room_id: u.room?.id || u.tenant.room_id || '',
      payment_type: 'RENT',
      total_target_amount: u.expectedRent,
      billing_period_month: `${currentYearMonth}-01`,
      billing_month: currentMonthFullName,
      amount_due: u.pendingDue,
      amount_paid: u.pendingDue,
      amount_pending: 0,
      payment_status: 'PAID',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'UPI',
      received_by: defaultReceiver,
      notes: u.rentPaidThisMonth > 0 
        ? `Monthly Rent - Slice (Prev paid: ₹${u.rentPaidThisMonth.toLocaleString('en-IN')})` 
        : 'Monthly Rent',
      created_at: new Date().toISOString(),
      tenant: u.tenant,
      room: u.room || undefined,
    });
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-7 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Property Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {totalRoomsCount} Units Active
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
            Real-time rent collection, overdue dues tracker, and tenant financial overview
          </p>
        </div>

        {/* Quick Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEditingPayment(null);
              setIsPaymentModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
          <Link
            href="/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Tenant
          </Link>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Expected Monthly Rent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Expected This Month</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ₹{totalRentExpected.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1.5">
              <span>{currentMonthFullName}</span>
              <span>•</span>
              <span>{activeTenants.length} Active Tenants</span>
            </p>
          </div>
        </div>

        {/* Card 2: Collected This Month with Progress Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Collected This Month</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              ₹{totalRentCollectedThisMonth.toLocaleString('en-IN')}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-700" 
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-bold">
              {collectionRate}% collected of target
            </p>
          </div>
        </div>

        {/* Card 3: Overdue Past 2-Day Grace */}
        <div className={`p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all group ${
          totalPendingRentPast2Days > 0 
            ? 'bg-rose-50/40 border-rose-200/90' 
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Overdue (Due + 2d)</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
              totalPendingRentPast2Days > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
              totalPendingRentPast2Days > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}>
              ₹{totalPendingRentPast2Days.toLocaleString('en-IN')}
            </div>
            <p className="text-xs mt-1 font-semibold">
              {unpaidTenantsPastDuePlus2.length > 0 ? (
                <span className="text-rose-700 font-bold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  {unpaidTenantsPastDuePlus2.length} tenant(s) past 2-day grace
                </span>
              ) : (
                <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Zero overdue past grace
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Card 4: Occupancy Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Occupancy</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {occupiedRoomsCount} / {totalRoomsCount}{' '}
              <span className="text-sm font-bold text-slate-500">Units</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-700" 
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-bold">
              {occupancyPercentage}% occupied • {vacantRoomsCount} vacant
            </p>
          </div>
        </div>
      </div>

      {/* Main Section: Rent Dues & Transactions Tracker */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Tracker Toolbar Header */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {dashboardViewMode === 'UNPAID_RENT' 
                  ? (unpaidFilter === 'DUE_PLUS_2' 
                      ? `Overdue Rent Dues (Due Date + 2 Days) — ${currentMonthFullName}` 
                      : `All Pending Rent Dues — ${currentMonthFullName}`)
                  : 'Recent Payment Transactions'}
              </h2>
              {unpaidTenantsPastDuePlus2.length > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  {unpaidTenantsPastDuePlus2.length} Overdue
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  All Clear
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {dashboardViewMode === 'UNPAID_RENT'
                ? (unpaidFilter === 'DUE_PLUS_2'
                    ? 'Tenants whose monthly rent due date and 2-day grace window have passed'
                    : `Active tenants with pending rent balances for ${currentMonthFullName}`)
                : 'Live log of recorded receipts and payments'}
            </p>
          </div>

          {/* Filter Pills & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setDashboardViewMode('UNPAID_RENT');
                  setUnpaidFilter('DUE_PLUS_2');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dashboardViewMode === 'UNPAID_RENT' && unpaidFilter === 'DUE_PLUS_2'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                🚨 Overdue +2d ({unpaidTenantsPastDuePlus2.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDashboardViewMode('UNPAID_RENT');
                  setUnpaidFilter('ALL_PENDING');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dashboardViewMode === 'UNPAID_RENT' && unpaidFilter === 'ALL_PENDING'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Pending ({unpaidTenantsThisMonth.length})
              </button>
              <button
                type="button"
                onClick={() => setDashboardViewMode('ALL_TRANSACTIONS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dashboardViewMode === 'ALL_TRANSACTIONS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recent Logs
              </button>
              <button
                type="button"
                onClick={() => setDashboardViewMode('ADVANCE_DEPOSITS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  dashboardViewMode === 'ADVANCE_DEPOSITS'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                }`}
              >
                <span>🔐 Advance Tracker</span>
                {totalPendingAdvance > 0 ? (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    dashboardViewMode === 'ADVANCE_DEPOSITS' ? 'bg-purple-900 text-purple-100' : 'bg-purple-100 text-purple-800'
                  }`}>
                    ₹{totalPendingAdvance.toLocaleString('en-IN')} pending
                  </span>
                ) : (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    dashboardViewMode === 'ADVANCE_DEPOSITS' ? 'bg-purple-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    Done ✓
                  </span>
                )}
              </button>
            </div>

            <Link 
              href="/payments" 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Full Ledger <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* TAB 1: UNPAID RENT DUES */}
        {dashboardViewMode === 'UNPAID_RENT' && (
          <div>
            {newTenantsThisMonth.length > 0 && (
              <div className="mx-4 mt-3 mb-2 p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold shrink-0 text-[10px]">
                    ✨ Move-In Policy
                  </span>
                  <span className="text-slate-700 font-medium">
                    <strong>{newTenantsThisMonth.length} new tenant{newTenantsThisMonth.length > 1 ? 's' : ''}</strong> ({newTenantsThisMonth.map((t) => t.full_name).join(', ')}) joined this month. Per policy, their first monthly rent will be collected next month ({nextMonthFullName}).
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-lg shrink-0">
                  🗓️ 1st Rent Due Next Month
                </span>
              </div>
            )}
            <div className="overflow-x-auto">
            {displayedUnpaidTenants.length === 0 ? (
              <div className="text-center py-12 px-4 bg-emerald-50/40">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {unpaidFilter === 'DUE_PLUS_2'
                    ? 'No Rent Dues Past Due Date + 2 Days! 🎉'
                    : `All Rent Cleared for ${currentMonthFullName}! 🎉`}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1 max-w-md mx-auto">
                  {unpaidFilter === 'DUE_PLUS_2'
                    ? `All active tenants have either paid their rent or are currently within their 2-day payment grace window for ${currentMonthFullName}.`
                    : 'Every active tenant has completed their rent payment for this month. There are zero pending dues.'}
                </p>
                {unpaidFilter === 'DUE_PLUS_2' && unpaidTenantsThisMonth.length > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setUnpaidFilter('ALL_PENDING')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Show {unpaidTenantsThisMonth.length} Tenant(s) within Grace Window / Upcoming
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Room & Tenant</th>
                    <th className="py-3 px-4">Due Date & 2d Grace</th>
                    <th className="py-3 px-4">Monthly Rent</th>
                    <th className="py-3 px-4">Paid This Month</th>
                    <th className="py-3 px-4">Pending Due</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedUnpaidTenants.map((u) => (
                    <tr key={u.tenant.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Room & Tenant */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block text-xs">
                          {u.room?.room_number ? `Room ${u.room.room_number}` : 'Room Unit'}
                        </span>
                        <span className="text-[11px] text-slate-700 font-semibold block">
                          {u.tenant.full_name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mt-0.5">
                          <span>{u.tenant.tenant_type === 'BACHELORS' ? '🎓 Bachelors' : '👨‍👩‍👦 Family'}</span>
                          <span>•</span>
                          <span>{u.tenant.phone}</span>
                        </div>
                      </td>

                      {/* Rent Due Date & Status */}
                      <td className="py-3.5 px-4">
                        {u.isPastDueDatePlus2 ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              Grace Expired ({u.daysOverGraceLimit}d past +2d)
                            </span>
                            <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                              Due was {u.rentDueDay}th • 2d grace ended {u.graceLimitDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ) : u.isOverdue ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              Within 2d Grace ({u.rentDueDay}th)
                            </span>
                            <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                              Grace ends {u.graceLimitDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                              Due in {u.daysRemaining} days
                            </span>
                            <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                              Due date: {u.rentDueDay}th {currentMonthShort}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Monthly Rent */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 text-xs">
                          ₹{u.expectedRent.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Paid This Month */}
                      <td className="py-3.5 px-4">
                        {u.rentPaidThisMonth > 0 ? (
                          <div>
                            <span className="font-bold text-amber-700 text-xs block">
                              ₹{u.rentPaidThisMonth.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] font-semibold text-amber-600 block">
                              Partial Slice Paid
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-semibold text-xs">
                            ₹0
                          </span>
                        )}
                      </td>

                      {/* Pending Due */}
                      <td className="py-3.5 px-4">
                        <span className="font-black text-rose-600 text-xs block">
                          ₹{u.pendingDue.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-rose-600 font-bold block">
                          Pending
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleQuickRecordRent(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                            title={`Record rent payment for ${u.tenant.full_name}`}
                          >
                            <Plus className="w-3 h-3" /> Record Rent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppReminder(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            title={`Send WhatsApp rent payment reminder to ${u.tenant.full_name}`}
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-600" /> Reminder
                          </button>
                          {u.tenant.phone && (
                            <a
                              href={`tel:${u.tenant.phone}`}
                              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title={`Call ${u.tenant.full_name} (${u.tenant.phone})`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

        {/* TAB 2: RECENT TRANSACTIONS */}
        {dashboardViewMode === 'ALL_TRANSACTIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Room / Tenant</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Paid Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500 font-semibold">
                      No payment records logged yet. Click &quot;Record Payment&quot; above to log an entry.
                    </td>
                  </tr>
                ) : (
                  payments.slice(0, 8).map((p) => {
                    const pType = p.payment_type || 'RENT';
                    const badgeLabel = 
                      pType === 'MAINTENANCE' ? '🛠️ Maint' :
                      pType === 'SECURITY_DEPOSIT' ? '🔐 Deposit' :
                      pType === 'ELECTRICITY' ? '⚡ EB' :
                      pType === 'OTHER' ? '📝 Misc' : '🏠 Rent';
                    const badgeStyle = 
                      pType === 'MAINTENANCE' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                      pType === 'SECURITY_DEPOSIT' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                      pType === 'ELECTRICITY' ? 'bg-cyan-100 text-cyan-900 border-cyan-300' :
                      pType === 'OTHER' ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-indigo-50 text-indigo-900 border-indigo-200';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{p.room?.room_number ? `Room ${p.room.room_number}` : 'Room'}</span>
                          <span className="text-[11px] text-slate-600 block">{p.tenant?.full_name || 'Tenant'}</span>
                          {p.notes && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-500 truncate max-w-[150px]" title={p.notes}>
                              <FileText className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{p.notes}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {p.billing_month || 'Current'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          ₹{Number(p.amount_paid).toLocaleString('en-IN')}
                          {Number(p.amount_pending) > 0 ? (
                            <span className="text-[10px] text-rose-600 block font-normal">
                              ₹{Number(p.amount_pending).toLocaleString('en-IN')} due
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-semibold">
                          {p.payment_method || 'UPI'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            p.payment_status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(p);
                              setIsPaymentModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Edit Payment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: ADVANCE DEPOSITS TRACKER (ONE-TIME PAYMENT) */}
        {dashboardViewMode === 'ADVANCE_DEPOSITS' && (
          <div>
            {/* Advance Overview Banner */}
            <div className="p-4 bg-purple-50/70 border-b border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-purple-200 text-purple-900 font-bold text-[10px]">
                    🔐 One-Time Payment Policy
                  </span>
                  <span className="font-bold text-slate-800">
                    Advance is collected once at move-in and is completely distinct from monthly rent.
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Tenants can pay the agreed advance in small pieces across different dates. Once the total agreed amount is paid, the advance is marked <strong>Done ✓</strong>.
                </p>
              </div>

              {/* Quick stats pills */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 font-bold text-purple-900">
                  Total Agreed: ₹{totalAgreedAdvance.toLocaleString('en-IN')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                  Collected: ₹{totalCollectedAdvance.toLocaleString('en-IN')}
                </span>
                {totalPendingAdvance > 0 ? (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 font-bold text-rose-700">
                    Unpaid: ₹{totalPendingAdvance.toLocaleString('en-IN')}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-black">
                    All Done ✓
                  </span>
                )}
              </div>
            </div>

            {/* Advance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tenant / Room</th>
                    <th className="py-3 px-4">Agreed Advance</th>
                    <th className="py-3 px-4">Paid So Far</th>
                    <th className="py-3 px-4">Unpaid Balance</th>
                    <th className="py-3 px-4">Payment Pieces & Dates</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantAdvanceList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500 font-semibold">
                        No active tenants found. Add a tenant to track their advance deposit.
                      </td>
                    </tr>
                  ) : (
                    tenantAdvanceList.map(({ tenant, room, summary }) => (
                      <tr key={tenant.id} className="hover:bg-purple-50/30 transition-colors">
                        {/* Tenant / Room */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{tenant.full_name}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {room?.room_number ? `Room ${room.room_number}` : 'Room'} • Move-in: {tenant.move_in_date || 'N/A'}
                          </span>
                        </td>

                        {/* Agreed Advance */}
                        <td className="py-3.5 px-4 font-black text-slate-900">
                          ₹{summary.agreedAdvance.toLocaleString('en-IN')}
                        </td>

                        {/* Paid So Far */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-emerald-700 block">
                            ₹{summary.totalPaid.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            {summary.piecesCount === 0
                              ? '0 pieces paid'
                              : `${summary.piecesCount} piece${summary.piecesCount > 1 ? 's' : ''}`}
                          </span>
                        </td>

                        {/* Unpaid Balance */}
                        <td className="py-3.5 px-4">
                          {summary.remainingUnpaid > 0 ? (
                            <div>
                              <span className="font-black text-rose-600 block">
                                ₹{summary.remainingUnpaid.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-rose-500 font-bold block">
                                Not Paid Yet
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ₹0 (Done)
                            </span>
                          )}
                        </td>

                        {/* Payment Pieces & Dates */}
                        <td className="py-3.5 px-4 max-w-[280px]">
                          {summary.pieces.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">No pieces recorded yet</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {summary.pieces.map((piece, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded text-[10px] font-bold"
                                  title={`Piece #${idx + 1}: ₹${piece.amount} via ${piece.payment_method || 'UPI'} on ${piece.payment_date || 'N/A'}${piece.notes ? ` (${piece.notes})` : ''}`}
                                >
                                  ₹{piece.amount.toLocaleString('en-IN')} • {piece.payment_date ? new Date(piece.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Date N/A'}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {summary.isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Done ✓
                            </span>
                          ) : summary.status === 'PARTIALLY_PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3" /> Partial ({summary.piecesCount} piece{summary.piecesCount > 1 ? 's' : ''})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3" /> Unpaid
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTenantForAdvance({ tenant, room, summary });
                                setIsAdvanceModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="View all pieces, dates, and breakdown"
                            >
                              Pieces Details →
                            </button>
                            {!summary.isFullyPaid && (
                              <button
                                type="button"
                                onClick={() => handleRecordAdvancePiece(tenant, summary.remainingUnpaid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                                title={`Collect next piece for ${tenant.full_name}`}
                              >
                                <Plus className="w-3 h-3" /> Collect Piece
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom 2 Refined Cards: Agreement Alerts & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card A: Lease Expiry & Agreement Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Lease & Agreement Alerts</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Tracking upcoming 45-day renewal deadlines</p>
                </div>
              </div>
              <Link href="/tenants" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                View All →
              </Link>
            </div>

            {expiringSoonTenants.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {expiringSoonTenants.slice(0, 4).map((t) => {
                  const end = new Date(t.lease_end_date);
                  const diffDays = Math.ceil((end.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={t.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{t.full_name}</p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {t.room?.room_number ? `Room ${t.room.room_number}` : 'Unit'} • Ends {end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {diffDays === 0 ? 'Expires Today' : `${diffDays} days left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-90" />
                <p className="text-xs font-bold text-slate-800">
                  {activeTenants.length > 0 ? `${activeTenants.length} Tenant Leases in Good Standing` : 'No Active Leases'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Zero tenant agreements expiring in the next 45 days. All stay durations are healthy.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Occupants Breakdown:</span>
            <span className="font-bold text-slate-800">
              {bachelorsCount} Bachelors • {familiesCount} Families
            </span>
          </div>
        </div>

        {/* Card B: Quick Navigation & Document Vault Gateway */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Document Vault & Fast Shortcuts</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Instant property operations and verification</p>
                </div>
              </div>
              <Link href="/documents" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                Open Vault →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Link 
                href="/documents" 
                className="p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/40 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">Document Vault</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Aadhars & Signed Agreements
                </p>
              </Link>

              <Link 
                href="/payments" 
                className="p-3 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/40 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">Payment Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Receipts, Dues & History
                </p>
              </Link>

              <Link 
                href="/rooms" 
                className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/40 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Rooms & Units</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Units, Floors & Rent Settings
                </p>
              </Link>

              <Link 
                href="/tenants" 
                className="p-3 rounded-xl border border-slate-200 hover:border-purple-400 bg-slate-50/60 hover:bg-purple-50/40 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-purple-700">Tenants Directory</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  {activeTenants.length} Active Records & Profiles
                </p>
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Encrypted Storage:</span>
            <span className="font-bold text-emerald-700">Online & Protected</span>
          </div>
        </div>
      </div>

      {/* Record / Edit Payment Modal */}
      {isPaymentModalOpen && (
        <RecordPaymentModal
          payment={editingPayment}
          tenants={tenants}
          rooms={rooms}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
          }}
          onSaved={(saved) => {
            setPayments((prev) => {
              const idx = prev.findIndex((p) => p.id === saved.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = saved;
                return updated;
              }
              return [saved, ...prev];
            });
          }}
        />
      )}

      {/* Advance Deposit Pieces & Details Modal */}
      {isAdvanceModalOpen && selectedTenantForAdvance && (
        <AdvanceDepositModal
          isOpen={isAdvanceModalOpen}
          tenant={selectedTenantForAdvance.tenant}
          room={selectedTenantForAdvance.room}
          summary={selectedTenantForAdvance.summary}
          onClose={() => setIsAdvanceModalOpen(false)}
          onRecordAdvancePiece={(tenant: Tenant, remaining: number) => handleRecordAdvancePiece(tenant, remaining)}
        />
      )}
    </div>
  );
}
