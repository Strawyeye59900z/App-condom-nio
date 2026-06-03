import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, Check, AlertCircle, RefreshCw, Building, User, ShieldCheck, RotateCcw } from 'lucide-react';

interface ProviderInfo {
  id: string;
  name: string;
  serviceType: string;
  residentName: string;
  apartment: string;
  block: string;
  accessExpiry: string;
}

export default function ServiceProviderRegistration({ token }: { token: string }) {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // step: 'idle' | 'camera' | 'preview' | 'done'
  const [step, setStep] = useState<'idle' | 'camera' | 'preview' | 'done'>('idle');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetch(`/api/providers/by-token/${token}`)
      .then(r => r.json())
      .then(data => { if (data.error) setLoadError(data.error); else setProviderInfo(data); })
      .catch(() => setLoadError('Falha ao carregar informações do convite.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Stop camera on unmount
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const startCamera = async () => {
    setPermissionError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError('Câmera não disponível. Certifique-se de acessar via HTTPS.');
      return;
    }
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setStep('camera');
      // Attach stream after state update causes re-render with video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setPermissionError('Permissão de câmera negada. Toque em "Permitir" e tente novamente.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    // Create canvas inline — always fresh, not a persisted ref
    const canvas = document.createElement('canvas');
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw mirrored (front camera)
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCapturedDataUrl(dataUrl);
    setStep('preview');
  };

  const retake = () => {
    setCapturedDataUrl(null);
    setUploadError(null);
    startCamera();
  };

  const submitPhoto = async () => {
    if (!capturedDataUrl) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/providers/register-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, photoDataUrl: capturedDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto.');
      setStep('done');
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao enviar. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-zinc-400 text-sm gap-2">
      <RefreshCw size={18} className="animate-spin" /> Carregando convite...
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-[#0f172a] border border-red-900/40 rounded-2xl p-8 text-center space-y-4">
        <AlertCircle size={40} className="text-red-400 mx-auto" />
        <h2 className="font-bold text-white text-lg">Link Inválido</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">{loadError}</p>
      </div>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="max-w-sm w-full bg-[#0f172a] border border-emerald-900/40 rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="font-bold text-white text-xl">Cadastro Concluído!</h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Sua foto foi registrada. Você já pode acessar o condomínio pelo reconhecimento facial.
        </p>
        {providerInfo && (
          <div className="p-3 bg-[#0a0f1e] border border-zinc-800 rounded-xl text-left">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mb-1">Acesso válido até</p>
            <p className="text-sm text-white font-semibold">
              {new Date(providerInfo.accessExpiry).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
        <p className="text-xs text-zinc-500">Você pode fechar esta página.</p>
      </motion.div>
    </div>
  );

  // ── Main flow ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020617] text-[#E4E4E7] flex flex-col font-sans">
      <header className="border-b border-white/5 bg-[#0f172a]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
            <Building size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white">{import.meta.env.VITE_APP_NAME}</h1>
            <p className="text-[10px] text-blue-300/60 font-mono uppercase tracking-widest">Cadastro de Acesso Facial</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 pt-6">
        <div className="w-full max-w-sm space-y-4">

          {/* Info card */}
          <div className="bg-[#0f172a] border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <User size={18} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Convite para</p>
                <h2 className="font-bold text-white text-base">{providerInfo?.name}</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5">
                <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono mb-0.5">Serviço</p>
                <p className="text-white font-medium">{providerInfo?.serviceType}</p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5">
                <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono mb-0.5">Apartamento</p>
                <p className="text-white font-medium">Apto {providerInfo?.apartment}</p>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 col-span-2">
                <p className="text-zinc-500 text-[9px] uppercase tracking-wider font-mono mb-0.5">Acesso válido até</p>
                <p className="text-emerald-400 font-semibold">
                  {providerInfo && new Date(providerInfo.accessExpiry).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* STEP: idle — instructions */}
          {step === 'idle' && (
            <div className="bg-[#0f172a] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-white">Como funciona</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                    Tire uma foto do seu rosto para que o sistema possa identificar você na entrada do condomínio.
                  </p>
                </div>
              </div>
              {permissionError && (
                <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-[11px] text-red-400 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {permissionError}
                </div>
              )}
              <button onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-sm transition-all cursor-pointer">
                <Camera size={18} /> Abrir Câmera
              </button>
            </div>
          )}

          {/* STEP: camera — live feed */}
          {step === 'camera' && (
            <div className="bg-[#0f172a] border border-zinc-800 rounded-2xl overflow-hidden space-y-3 p-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider text-center font-mono">
                Posicione seu rosto no centro e tire a foto
              </p>
              <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-44 h-52 border-2 border-dashed border-yellow-400/60 rounded-full" />
                </div>
              </div>
              <button onClick={capturePhoto}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2">
                <Camera size={18} /> Tirar Foto
              </button>
            </div>
          )}

          {/* STEP: preview — confirm */}
          {step === 'preview' && capturedDataUrl && (
            <div className="bg-[#0f172a] border border-zinc-800 rounded-2xl overflow-hidden space-y-3 p-4">
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider text-center font-mono">
                Confirme sua foto
              </p>
              <div className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                <img src={capturedDataUrl} alt="Sua foto" className="w-full h-full object-cover" />
              </div>
              {uploadError && (
                <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-[11px] text-red-400 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {uploadError}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={retake} disabled={uploading}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-sm border border-zinc-700 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  <RotateCcw size={14} /> Repetir
                </button>
                <button onClick={submitPhoto} disabled={uploading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {uploading ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
