import React from 'react';
import { X, ShieldAlert, ShieldCheck, Lock, Globe, Server, AlertOctagon } from 'lucide-react';

interface SecurityPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityPolicyModal: React.FC<SecurityPolicyModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">SSRF Defense & Sandbox Security Policy</h3>
              <p className="text-xs text-slate-400">Strict isolation specifications (TSD Section 5 & 22)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
            <h4 className="font-bold text-cyan-300 text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>Zero-Trust Architecture for Untrusted Web Targets</span>
            </h4>
            <p className="text-slate-300">
              AI Launch QA treats every audited URL as potentially hostile. Isolated headless browser worker instances run with no host filesystem access and no access to internal secrets.
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Enforced Security Boundaries
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                <span className="font-bold text-rose-300 block flex items-center gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  <span>Private IP & Loopback Blocking</span>
                </span>
                <p className="text-slate-400 text-[11px]">
                  Rejects `127.0.0.1`, `localhost`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                <span className="font-bold text-rose-300 block flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" />
                  <span>Cloud Metadata Protection</span>
                </span>
                <p className="text-slate-400 text-[11px]">
                  Blocks `169.254.169.254`, `metadata.google.internal`, and internal discovery addresses.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                <span className="font-bold text-amber-300 block flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Protocol Enforcement</span>
                </span>
                <p className="text-slate-400 text-[11px]">
                  Only `http:` and `https:` schemes are allowed. Schemes like `file:`, `ftp:`, `data:`, `javascript:` are rejected.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                <span className="font-bold text-emerald-300 block flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Redirect Re-Validation</span>
                </span>
                <p className="text-slate-400 text-[11px]">
                  Every HTTP redirect is re-evaluated against the security policy before subsequent navigation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
