'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Activity, CheckCircle2, Clock, 
  ExternalLink, Copy, Check, RefreshCw, Zap
} from 'lucide-react';

interface RenderKeepAliveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RenderKeepAliveModal({ isOpen, onClose }: RenderKeepAliveModalProps) {
  const [healthData, setHealthData] = useState<{
    status?: string;
    uptimeFormatted?: string;
    totalPingsReceived?: number;
    timestamp?: string;
    isRender?: boolean;
    renderUrl?: string | null;
  } | null>(null);

  const [pinging, setPinging] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoHeartbeatEnabled, setAutoHeartbeatEnabled] = useState(true);

  // Determine current public URL
  const publicBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const healthEndpointUrl = `${publicBaseUrl}/api/health`;

  const performPing = useCallback(async () => {
    setPinging(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      setPingLatency(latency);
      if (res.ok) {
        const json = await res.json();
        setHealthData(json);
      }
    } catch (err) {
      console.warn('Ping test error:', err);
    } finally {
      setPinging(false);
    }
  }, []);

  // Fetch initial health status asynchronously
  useEffect(() => {
    let ignore = false;
    async function loadInitialStatus() {
      const start = performance.now();
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const latency = Math.round(performance.now() - start);
        if (!ignore && res.ok) {
          const json = await res.json();
          setHealthData(json);
          setPingLatency(latency);
        }
      } catch {
        // ignore in dev
      }
    }

    loadInitialStatus();
    return () => {
      ignore = true;
    };
  }, []);

  // Client-side auto-heartbeat (every 10 minutes while tab is open)
  useEffect(() => {
    if (!autoHeartbeatEnabled) return;
    const interval = setInterval(() => {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoHeartbeatEnabled]);

  const copyUrl = () => {
    navigator.clipboard.writeText(healthEndpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Render Anti-Sleep &amp; Keep-Alive
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  ACTIVE
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Prevents Render free web service from idling / sleeping
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-emerald-950">
                Server Anti-Sleep Daemon Running
              </h3>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                A background heartbeat requests <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-[10px]">/api/health</code> every 12 minutes to keep Render active and prevent the 50-second cold start delay.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Server Uptime</span>
              <p className="text-xs font-black text-slate-900 mt-1">
                {healthData?.uptimeFormatted || 'Active'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Heartbeats Sent</span>
              <p className="text-xs font-black text-indigo-700 mt-1">
                {healthData?.totalPingsReceived ?? 1} pings
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ping Latency</span>
              <p className="text-xs font-black text-emerald-700 mt-1">
                {pingLatency !== null ? `${pingLatency} ms` : 'Measuring...'}
              </p>
            </div>
          </div>

          {/* Live Ping Button */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Test Health Request</span>
              <span className="text-[11px] text-slate-500">Trigger an immediate keep-alive request now</span>
            </div>
            <button
              type="button"
              onClick={performPing}
              disabled={pinging}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:bg-indigo-400"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pinging ? 'animate-spin' : ''}`} />
              {pinging ? 'Pinging...' : 'Ping Now'}
            </button>
          </div>

          {/* Client Tab Heartbeat Toggle */}
          <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Browser Tab Heartbeat</span>
                <span className="text-[11px] text-slate-500">Auto-pings every 10 min while this tab is open</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoHeartbeatEnabled}
                onChange={(e) => setAutoHeartbeatEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Guaranteed 24/7 Setup (Cron-Job / UptimeRobot) */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Guaranteed 24/7 Anti-Sleep (Free)
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                Recommended for Render
              </span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              If your Render server is ever stopped completely, an external free pinger (like <strong>cron-job.org</strong> or <strong>UptimeRobot</strong>) wakes it up and keeps it alive 24/7 forever.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Your Anti-Sleep Health Endpoint URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={healthEndpointUrl}
                  className="w-full text-xs font-mono bg-white border border-indigo-200 rounded-lg p-2 text-slate-800"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 pt-1">
              <p className="font-semibold text-slate-800">30-second setup on Cron-Job.org:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Create a free account on <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5">cron-job.org <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Add a cron job with the copied URL above</li>
                <li>Set schedule to <strong>Every 10 or 14 minutes</strong></li>
                <li>Save — your Render app will now NEVER sleep or spin down!</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
