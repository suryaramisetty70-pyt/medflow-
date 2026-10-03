import React from 'react';
import {
  Globe,
  Building,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Server,
  Zap,
  Users,
  Database,
} from 'lucide-react';
import { getHospitals, getAppointments } from '../../services/storage';

export const SuperAdminDashboard: React.FC = () => {
  const hospitals = getHospitals();
  const allAppointments = getAppointments();

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            Platform Level Multi-Hospital Director Console
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            MEDFLOW AI Enterprise Fleet
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-tenant hospital management, system telemetry, and platform security governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            All 3 Hospital Tenants Online
          </span>
        </div>
      </div>

      {/* Fleet Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Hospital Tenants</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{hospitals.length}</div>
          <div className="text-[11px] text-teal-600 font-semibold mt-0.5">100% operational</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Platform Bookings</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{allAppointments.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across all facilities</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">AI Scheduling Latency</div>
          <div className="text-2xl font-black text-purple-600 mt-1">142ms</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Gemini 3.8 Flash</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Security SLA</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">99.98%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">RBAC & Tenant Isolation</div>
        </div>
      </div>

      {/* Hospital Tenants Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Provisioned Hospital Medical Centers</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hospitals.map((hosp) => {
            const hospApts = allAppointments.filter((a) => a.hospitalId === hosp.id);
            return (
              <div key={hosp.id} className="p-5 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {hosp.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ACTIVE
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 mt-2">{hosp.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{hosp.tagline}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <div>📍 {hosp.address}, {hosp.city}</div>
                  <div>📞 {hosp.phone}</div>
                  <div className="text-teal-700 font-semibold mt-1">
                    {hospApts.length} total scheduled patient visits
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
