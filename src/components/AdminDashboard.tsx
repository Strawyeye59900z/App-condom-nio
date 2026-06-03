/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trash2,
  Eye,
  Search,
  CheckCircle2,
  Clock,
  Users,
  RefreshCw,
  LogOut,
  RotateCcw,
  ChevronRight,
  ShieldCheck,
  Building,
  Lock,
  Download,
  ShieldAlert,
  KeyRound,
  FolderSync
} from 'lucide-react';
import { Resident, ServiceProvider } from '../types';
import { logout } from '../pocketbase';
import ReservationSection from './ReservationSection';
import ReservationCalendar from './ReservationCalendar';
import AdminAreasPanel from './AdminAreasPanel';
import WhatsAppPanel from './WhatsAppPanel';
import HikvisionPanel from './HikvisionPanel';
import { Reservation, CommonArea } from '../types';

interface AdminDashboardProps {
  user: any;
  onLogin: (user: any) => void;
  onLogout: () => void;
  onBack?: () => void;
}

export default function AdminDashboard({ user, onLogin, onLogout, onBack }: AdminDashboardProps) {
  const [adminSubTab, setAdminSubTab] = useState<'moradores' | 'reservas' | 'funcionarios' | 'calendario' | 'whatsapp' | 'hikvision' | 'prestadores' | 'areas'>('moradores');
  const [commonAreas, setCommonAreas] = useState<CommonArea[]>([]);

  const fetchCommonAreas = async () => {
    try {
      const res = await fetch('/api/areas');
      if (res.ok) setCommonAreas(await res.json());
    } catch { /* silencioso */ }
  };
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null);
  // Session is owned by the parent <App>; this component is fully controlled.
  const googleUser = user;
  const [residents, setResidents] = useState<Resident[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [loggingInToggle, setLoggingInToggle] = useState<boolean>(false);
  
  // Modal preview photo
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; url: string } | null>(null);
  const [selectedNotRegisteredResident, setSelectedNotRegisteredResident] = useState<Resident | null>(null);

  // States for Authorized Admin management
  const [authorizedAdmins, setAuthorizedAdmins] = useState<string[]>([import.meta.env.VITE_ADMIN_EMAIL || '']);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [deletingResidentId, setDeletingResidentId] = useState<string | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [resettingEmployeeId, setResettingEmployeeId] = useState<string | null>(null);
  const [resettingResidentId, setResettingResidentId] = useState<string | null>(null);
  const [residentResetPassword, setResidentResetPassword] = useState('');
  const [residentResetUsername, setResidentResetUsername] = useState('');

  // Employees administration states and actions
  const [employees, setEmployees] = useState<{ id: string; name: string; needsPasswordSet: boolean; photoDataUrl?: string }[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [employeeSuccess, setEmployeeSuccess] = useState('');

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    setEmployeeError('');
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        setEmployees(await res.json());
      } else {
        setEmployeeError('Erro ao carregar funcionários.');
      }
    } catch (err) {
      setEmployeeError('Erro de conexão.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEmployeeName.trim() }),
      });

      if (res.ok) {
        setNewEmployeeName('');
        setEmployeeSuccess('Funcionário adicionado com sucesso!');
        await fetchEmployees();
        setTimeout(() => setEmployeeSuccess(''), 3000);
      } else {
        const data = await res.json();
        setEmployeeError(data.error || 'Erro ao adicionar.');
      }
    } catch (err) {
      setEmployeeError('Erro de conexão.');
    }
  };

  const handleSetEmployeePassword = async (employeeId: string, password: string) => {
    console.log('Setting password for:', employeeId, 'password length:', password.length);
    try {
      const res = await fetch('/api/employees/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password }),
      });
      const data = await res.json();
      console.log('Response:', data);
      if (res.ok) {
        await fetchEmployees();
        alert('Senha definida!');
      } else {
        alert('Erro ao definir senha: ' + (data.error || 'Erro'));
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    }
  };

  const handleSetConciergePassword = async (password: string) => {
    try {
      const res = await fetch('/api/concierge/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        alert('Senha da portaria alterada com sucesso!');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao definir senha da portaria.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    }
  };

  const handleStartDeleteEmployee = (id: string) => {
    setDeletingEmployeeId(id);
  };

  const confirmDeleteEmployee = async (id: string) => {
    try {
      const res = await fetch('/api/employees/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchEmployees();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao remover.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const handleResetEmployeePassword = async (id: string) => {
    try {
      const res = await fetch('/api/employees/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setEmployeeSuccess('Senha resetada com sucesso! O funcionário deverá definir uma nova senha no próximo acesso.');
        await fetchEmployees();
        setTimeout(() => setEmployeeSuccess(''), 5000);
      } else {
        const data = await res.json();
        setEmployeeError(data.error || 'Erro ao resetar senha.');
      }
    } catch (err) {
      setEmployeeError('Erro de conexão ao tentar resetar senha.');
    } finally {
      setResettingEmployeeId(null);
    }
  };

  const handleUploadEmployeePhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/employees/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, photoDataUrl: base64 }),
        });
        if (res.ok) {
          fetchEmployees();
        } else {
          const data = await res.json();
          alert(data.error || 'Erro ao subir foto.');
        }
      } catch (err) {
        alert('Erro de conexão.');
      }
    };
    reader.readAsDataURL(file);
  };


  // Fetch dynamic administrator emails
  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admins');
      if (res.ok) {
        const data = await res.json();
        setAuthorizedAdmins(data);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  // Add a new administrator email
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      setAdminError('Insira um e-mail válido!');
      return;
    }
    try {
      const res = await fetch('/api/admins/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthorizedAdmins(data.authorizedAdmins);
        setNewAdminEmail('');
        setAdminSuccess('Administrador cadastrado com sucesso!');
      } else {
        setAdminError(data.error || 'Erro ao adicionar administrador.');
      }
    } catch (err) {
      setAdminError('Conexão falhou ao salvar.');
    }
  };

  // Delete an administrator email
  const handleDeleteAdmin = async (emailToDelete: string) => {
    setAdminError('');
    setAdminSuccess('');
    if (emailToDelete === import.meta.env.VITE_ADMIN_EMAIL) {
      setAdminError('Não é possível remover o administrador principal.');
      return;
    }
    try {
      const res = await fetch('/api/admins/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthorizedAdmins(data.authorizedAdmins);
        setAdminSuccess('Administrador removido com sucesso!');
      } else {
        setAdminError(data.error || 'Erro ao remover admin.');
      }
    } catch (err) {
      setAdminError('Conexão falhou ao deletar.');
    }
  };

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/residents');
      if (response.ok) {
        const data = await response.json();
        setResidents(data);
      }
    } catch (err) {
      console.error('Error fetching residents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/reservations');
      if (response.ok) {
        setReservations(await response.json());
      }
    } catch (err) {
      console.error('Error fetching reservations:', err);
    }
  };

  // Toggle device registration status
  const handleToggleDeviceRegistered = async (id: string, currentlyRegistered: boolean) => {
    try {
      const response = await fetch('/api/residents/update-device-registered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          deviceRegistered: !currentlyRegistered
        })
      });

      if (response.ok) {
        if (selectedNotRegisteredResident?.id === id) {
          // Find the list of residents who have photo but are not registered yet
          const pendingRegList = residents.filter(r => r.photoDataUrl && !r.deviceRegistered && r.id !== id);
          if (pendingRegList.length > 0) {
            // Find current index in displayResidents
            const currentIdx = displayResidents.findIndex(r => r.id === id);
            // Get next pending resident in displaying sequence
            const nextInList = displayResidents.slice(currentIdx + 1).find(r => r.id !== id && r.photoDataUrl && !r.deviceRegistered);
            const prevInList = [...displayResidents].reverse().find(r => r.id !== id && r.photoDataUrl && !r.deviceRegistered);
            setSelectedNotRegisteredResident(nextInList || prevInList || pendingRegList[0] || null);
          } else {
            setSelectedNotRegisteredResident(null);
          }
        }
        await fetchResidents();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erro ao atualizar status.');
      }
    } catch (err) {
      console.error('Error toggling device registration:', err);
    }
  };

  const handleDownloadPhoto = async (res: Resident) => {
    try {
      const response = await fetch(`/api/residents/photo/${res.id}`);
      if (!response.ok) throw new Error('Falha ao obter foto.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.name}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download err:', err);
      if (res.photoDataUrl) {
        const a = document.createElement('a');
        a.href = res.photoDataUrl;
        a.download = `${res.name}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  useEffect(() => {
    fetchResidents();
    fetchAdmins();
    fetchEmployees();
    fetchReservations();

    const handleUpdate = () => {
      fetchReservations();
    };
    window.addEventListener('reservation-updated', handleUpdate);
    return () => {
      window.removeEventListener('reservation-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (adminSubTab === 'funcionarios') fetchEmployees();
    if (adminSubTab === 'prestadores') fetchProviders();
    if (adminSubTab === 'calendario' || adminSubTab === 'reservas') fetchCommonAreas();
  }, [adminSubTab]);

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const res = await fetch('/api/providers');
      if (res.ok) setProviders(await res.json());
    } catch { /* silently ignore */ }
    finally { setLoadingProviders(false); }
  };

  const syncProviderToHikvision = async (provider: ServiceProvider) => {
    setSyncingProviderId(provider.id);
    try {
      const res = await fetch('/api/providers/sync-hikvision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provider.id }),
      });
      const data = await res.json();
      if (res.ok) await fetchProviders();
      else alert(data.error || 'Erro ao sincronizar.');
    } catch { alert('Falha de conexão.'); }
    finally { setSyncingProviderId(null); }
  };

  const deleteProvider = async (id: string) => {
    try {
      await fetch('/api/providers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setDeletingProviderId(null);
      await fetchProviders();
    } catch { /* silently ignore */ }
  };

  useEffect(() => {
    if (filterStatus === 'not_registered_device') {
      const pendingRegList = residents.filter(r => r.photoDataUrl && !r.deviceRegistered);
      if (pendingRegList.length > 0) {
        if (!selectedNotRegisteredResident || !pendingRegList.some(r => r.id === selectedNotRegisteredResident.id)) {
          setSelectedNotRegisteredResident(pendingRegList[0]);
        }
      } else {
        setSelectedNotRegisteredResident(null);
      }
    } else {
      setSelectedNotRegisteredResident(null);
    }
  }, [filterStatus, residents]);

  // States for Local password/email Admin Authentication
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [isFirstAccessSetup, setIsFirstAccessSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  // Handle Local Admin/Sub-Admin Login
  const handleLocalAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoggingInToggle(true);

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAuthError('E-mail e senha são obrigatórios.');
      setLoggingInToggle(false);
      return;
    }

    try {
      // 1. Check if email is authorized and needs setup
      const statusRes = await fetch('/api/admins/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim() })
      });

      if (!statusRes.ok) {
        throw new Error('Falha ao verificar status do administrador.');
      }

      const statusData = await statusRes.json();
      if (!statusData.authorized) {
        setAuthError(statusData.error || 'Acesso negado: Este e-mail não possui privilégios de administrador.');
        setLoggingInToggle(false);
        return;
      }

      if (statusData.needsSetup) {
        // Switch view to password setup
        setIsFirstAccessSetup(true);
        setLoggingInToggle(false);
        return;
      }

      // 2. Perform regular local login
      const loginRes = await fetch('/api/admins/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(loginData.error || 'Erro ao realizar login.');
      }

      // Successful login — hand the session up to <App>
      setAuthError('');
      onLogin(loginData.user);
    } catch (err: any) {
      setAuthError(err.message || 'Erro de conexão.');
    } finally {
      setLoggingInToggle(false);
    }
  };

  // Handle first-access password formulation
  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSetupLoading(true);

    if (adminPassword !== adminConfirmPassword) {
      setAuthError('As senhas não coincidem.');
      setSetupLoading(false);
      return;
    }

    if (adminPassword.length < 4) {
      setAuthError('A senha deve ter no mínimo 4 caracteres.');
      setSetupLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admins/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cadastrar senha.');
      }

      // Successfully registered! Now perform login
      setIsFirstAccessSetup(false);
      
      // Perform automated local login
      const loginRes = await fetch('/api/admins/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const loginData = await loginRes.json();
      if (loginRes.ok) {
        onLogin(loginData.user);
      } else {
        setAuthError('Senha cadastrada com sucesso! Faça o login novamente.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao configurar senha.');
    } finally {
      setSetupLoading(false);
    }
  };

  // Handle Sign Out — only triggered by the explicit logout button
  const handleGoogleSignOut = async () => {
    try {
      if (googleUser && !googleUser.isLocalAdmin) {
        await logout();
      }
    } catch (err) {
      console.warn("PocketBase logout failed:", err);
    }
    setAccessToken(null);
    setAdminEmail('');
    setAdminPassword('');
    setAdminConfirmPassword('');
    setIsFirstAccessSetup(false);
    setSyncLogs([]);
    // Parent clears the session and returns to the resident portal.
    onLogout();
  };

  // Reset resident password
  const handleResetResidentPassword = async (id: string, newPassword: string, newUsername?: string) => {
    try {
      const res = await fetch('/api/residents/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newPassword, newUsername: newUsername || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminSuccess('Credenciais do morador redefinidas com sucesso!');
        setTimeout(() => setAdminSuccess(''), 4000);
        await fetchResidents();
      } else {
        setAdminError(data.error || 'Erro ao redefinir credenciais.');
        setTimeout(() => setAdminError(''), 4000);
      }
    } catch {
      setAdminError('Erro de conexão ao redefinir credenciais.');
      setTimeout(() => setAdminError(''), 4000);
    } finally {
      setResettingResidentId(null);
      setResidentResetPassword('');
      setResidentResetUsername('');
    }
  };

  // Handle delete resident account
  const handleDeleteResident = async (id: string, name: string) => {
    // Save to target state trigger first to let custom alert render securely inside iframe
    setDeletingResidentId(id);
  };

  const confirmDeleteResident = async (id: string) => {
    try {
      const response = await fetch('/api/residents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setResidents(prev => prev.filter(r => r.id !== id));
        if (selectedNotRegisteredResident?.id === id) {
          setSelectedNotRegisteredResident(null);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao deletar morador.');
      }
    } catch (err) {
      console.error('Error deleting resident:', err);
      alert('Erro ao excluir do servidor.');
    } finally {
      setDeletingResidentId(null);
    }
  };

  // Helper calculations
  const totalCount = residents.length;
  const syncedCount = residents.filter(r => r.syncStatus === 'synced').length;
  const pendingCount = residents.filter(r => r.photoDataUrl && r.syncStatus === 'pending').length;
  const noPhotoCount = residents.filter(r => !r.photoDataUrl).length;
  const notRegisteredDeviceCount = residents.filter(r => r.photoDataUrl && !r.deviceRegistered).length;

  // Filter & Search Resident array
  const filteredResidents = residents.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.apartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.block.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'synced') return matchesSearch && r.syncStatus === 'synced';
    if (filterStatus === 'pending') return matchesSearch && r.photoDataUrl && r.syncStatus === 'pending';
    if (filterStatus === 'nophoto') return matchesSearch && !r.photoDataUrl;
    if (filterStatus === 'failed') return matchesSearch && r.syncStatus === 'failed';
    if (filterStatus === 'not_registered_device') return matchesSearch && r.photoDataUrl && !r.deviceRegistered;
    
    return matchesSearch;
  });

  const displayResidents = filterStatus === 'not_registered_device'
    ? [...filteredResidents].sort((a, b) => {
        const aptA = parseInt(a.apartment, 10);
        const aptB = parseInt(b.apartment, 10);
        if (!isNaN(aptA) && !isNaN(aptB)) {
          if (aptA !== aptB) return aptA - aptB;
        }
        const comp = a.apartment.localeCompare(b.apartment, undefined, { numeric: true });
        if (comp !== 0) return comp;
        return a.name.localeCompare(b.name);
      })
    : filteredResidents;

  if (!googleUser) {
    return (
      <div className="w-full max-w-md mx-auto bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/40 p-8 space-y-6 text-left">
        <div className="flex justify-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center text-gold border border-gold/15">
            <Lock size={32} />
          </div>
        </div>

        {isFirstAccessSetup ? (
          /* FIRST TIME PASSWORD SETUP FORM */
          <div className="space-y-4">
            <div className="text-center">
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono">
                Primeiro Acesso
              </span>
              <h2 className="font-display text-[17px] font-bold text-white tracking-tight mt-2">Cadastrar Minha Senha</h2>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                O e-mail <strong className="text-zinc-200">{adminEmail}</strong> está autorizado pelo coordenador. Escolha uma senha segura para seus acessos.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 text-red-400 text-xs border border-red-900/35 rounded-xl font-medium leading-relaxed font-sans">
                {authError}
              </div>
            )}

            <form onSubmit={handlePasswordSetup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">Escolha uma Senha</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">Confirme a Senha</label>
                <input
                  type="password"
                  required
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Repita a senha escolhida"
                  className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
              >
                {setupLoading ? 'Cadastrando...' : 'Cadastrar Senha e Acessar'}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsFirstAccessSetup(false);
                  setAuthError('');
                }}
                className="text-xs text-zinc-500 hover:text-white underline font-medium cursor-pointer"
              >
                Voltar para o Login
              </button>
            </div>
          </div>
        ) : (
          /* REGULAR EMAIL/PASSWORD LOGIN FORM */
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="font-display text-lg font-bold text-white tracking-tight">Painel do Síndico</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1 font-sans">
                Insira o seu e-mail designado pelo coordenador do projeto e sua senha de acesso.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/40 text-red-400 text-xs border border-red-900/35 rounded-xl font-medium leading-relaxed font-sans">
                {authError}
              </div>
            )}

            <form onSubmit={handleLocalAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">E-mail do Administrador</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="exemplo@condominio.com"
                  className="w-full px-3.5 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600 font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-display block">Senha de Acesso</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full px-3.5 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold text-white placeholder-zinc-600 font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={loggingInToggle}
                className="w-full py-2.5 font-bold rounded-xl text-xs text-black bg-gold hover:bg-gold-hover transition-colors shadow-lg shadow-gold/15 cursor-pointer disabled:opacity-50"
              >
                {loggingInToggle ? 'Autenticando...' : 'Acessar com E-mail'}
              </button>
            </form>

            <div className="pt-4 border-t border-dark-border/60 mt-5 text-center">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-zinc-500 hover:text-zinc-300 font-medium cursor-pointer"
              >
                Voltar para o Portal Principal
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="admin-dashboard-container" className="space-y-6 w-full max-w-7xl mx-auto">
      
      {/* ADMIN HEADER */}
      <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gold-light rounded-xl text-gold shrink-0">
            <Building size={24} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white tracking-tight">Área do Síndico</h1>
            <p className="text-xs text-zinc-400 mt-1 font-mono">{googleUser?.email}</p>
          </div>
        </div>
        <button
          onClick={handleGoogleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 text-red-400 hover:text-red-300 text-xs font-semibold rounded-xl cursor-pointer transition-all"
        >
          <LogOut size={14} /> Sair
        </button>
      </div>

      {/* TABS SELECTOR FOR ADMIN */}
      <div className="flex flex-wrap bg-dark-input rounded-xl p-1 gap-1 border border-dark-border select-none">
        <button
          onClick={() => setAdminSubTab('moradores')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'moradores' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Moradores
        </button>
        <button
          onClick={() => setAdminSubTab('reservas')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'reservas' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Reservas
        </button>
        <button
          onClick={() => setAdminSubTab('funcionarios')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'funcionarios' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Funcionários
        </button>
        <button
          onClick={() => setAdminSubTab('calendario')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'calendario' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'text-zinc-400 hover:text-white'}`}
        >
          Calendário
        </button>
        <button
          onClick={() => setAdminSubTab('whatsapp')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'whatsapp' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' : 'text-zinc-400 hover:text-white'}`}
        >
          💬 WhatsApp
        </button>
        <button
          onClick={() => setAdminSubTab('hikvision')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'hikvision' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-zinc-400 hover:text-white'}`}
        >
          📷 Hikvision
        </button>
        <button
          onClick={() => setAdminSubTab('prestadores')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'prestadores' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' : 'text-zinc-400 hover:text-white'}`}
        >
          🧹 Prestadores
        </button>
        <button
          onClick={() => setAdminSubTab('areas')}
          className={`flex-1 py-2 px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all font-display cursor-pointer whitespace-nowrap ${adminSubTab === 'areas' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30' : 'text-zinc-400 hover:text-white'}`}
        >
          🏠 Áreas
        </button>
      </div>

      {adminSubTab === 'moradores' && (
        <>
          {/* OVERVIEW STATS CARDS GRID */}
      <div id="admin-stats-grid" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-display">Cadastros</span>
            <Users size={16} />
          </div>
          <h3 className="font-display text-2xl font-bold text-white">{totalCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Moradores cadastrados</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-display">Sincronizados</span>
            <CheckCircle2 size={16} />
          </div>
          <h3 className="font-display text-2xl font-bold text-emerald-400">{syncedCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Com foto cadastrada</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-display">Pendentes</span>
            <Clock size={16} />
          </div>
          <h3 className="font-display text-2xl font-bold text-amber-400">{pendingCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Aguardando sync</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider font-display">Sem Facial</span>
            <Building size={16} className="text-zinc-600" />
          </div>
          <h3 className="font-display text-2xl font-bold text-zinc-400">{noPhotoCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Sem upload de foto</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-display font-medium">Pendente Aparelho</span>
            <ShieldAlert size={16} className="text-purple-400" />
          </div>
          <h3 className="font-display text-2xl font-bold text-purple-400">{notRegisteredDeviceCount}</h3>
          <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">Não reg. no facial físico</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT SIDEBAR SECTION */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          {/* ADMIN MANAGEMENT CARD */}
          <div className="bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-gold" />
              <h3 className="font-display text-base font-semibold text-white">Administradores Autorizados</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Dê acesso de administrador a outros e-mails para gerenciar moradores e configurações.
            </p>

            <form onSubmit={handleAddAdmin} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="E-mail do novo administrador"
                  className="flex-1 px-3 py-1.5 bg-dark-input border border-dark-border rounded-lg text-xs focus:outline-none focus:border-gold transition-all text-white placeholder-zinc-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-black font-semibold text-xs rounded-lg transition-colors font-display cursor-pointer shrink-0"
                >
                  Adicionar
                </button>
              </div>
              {adminError && <p className="text-[10px] text-red-400 font-medium">{adminError}</p>}
              {adminSuccess && <p className="text-[10px] text-emerald-400 font-medium">{adminSuccess}</p>}
            </form>

            <div className="border-t border-dark-border/40 pt-3 space-y-1.5 max-h-[148px] overflow-y-auto pr-1">
              {authorizedAdmins.map((email) => {
                const isPrimary = email === import.meta.env.VITE_ADMIN_EMAIL;
                return (
                  <div key={email} className="flex items-center justify-between gap-2 p-2 bg-dark-input/30 rounded-lg border border-dark-border/10 text-xs">
                    <span className="truncate text-zinc-300 font-mono text-[10px]">{email}</span>
                    {isPrimary ? (
                      <span className="px-1.5 py-0.5 bg-gold/15 text-gold text-[8px] font-bold rounded uppercase font-mono shrink-0">
                        Principal
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteAdmin(email)}
                        className="text-[9px] text-red-400 hover:text-red-300 transition-colors uppercase font-bold tracking-wide cursor-pointer font-mono"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RESIDENTS TABLE LIST */}
        <div className="lg:col-span-2 bg-dark-card border border-dark-border rounded-2xl shadow-xl shadow-black/30 p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-border">
            <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
              <Users size={18} className="text-gold" />
              Lista de Residentes
              <button
                onClick={fetchResidents}
                disabled={loading}
                title="Atualizar lista"
                className="ml-1 p-1.5 rounded-lg border border-dark-border text-zinc-400 hover:text-white bg-dark-input hover:bg-dark-hover transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </h3>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1">
              <button
                id="admin-filter-all"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'all' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Todos
              </button>
              <button
                id="admin-filter-pending"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'pending' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Pendentes
              </button>
              <button
                id="admin-filter-synced"
                onClick={() => setFilterStatus('synced')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'synced' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Sincronizados
              </button>
              <button
                id="admin-filter-failed"
                onClick={() => setFilterStatus('failed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'failed' ? 'bg-gold text-black' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Erro
              </button>
              <button
                id="admin-filter-not-registered"
                onClick={() => setFilterStatus('not_registered_device')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors font-display ${filterStatus === 'not_registered_device' ? 'bg-purple-600 text-white shadow-lg shadow-purple-650/15' : 'bg-dark-input hover:bg-dark-hover text-zinc-400 border border-dark-border'}`}
              >
                Não Cadastrados (Aparelho)
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="my-4 relative grid grid-cols-1 select-none">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              id="admin-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, apartamento ou bloco..."
              className="w-full pl-9 pr-4 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition-all text-white placeholder-zinc-650 font-sans"
            />
          </div>

          {/* TABLE CONTAINER */}
          <div className="flex-1 overflow-x-auto select-text">
            {loading ? (
              <div className="py-12 text-center text-zinc-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-gold" />
                Carregando registros...
              </div>
            ) : displayResidents.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                Nenhum morador encontrado com o filtro selecionado.
              </div>
            ) : filterStatus === 'not_registered_device' ? (
              <div id="admin-not-registered-split-view" className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 select-text">
                {/* LEFT COLUMN: GROUPED LISTS BY APARTMENT IN ASCENDING ORDER */}
                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>Moradores Faltando Cadastro ({displayResidents.length})</span>
                  </div>
                  
                  {(() => {
                    const groupedByApartment: { [apt: string]: Resident[] } = {};
                    displayResidents.forEach(res => {
                      const key = `Apto ${res.apartment}${res.block && res.block !== 'Único' ? ` / Bloco ${res.block}` : ''}`;
                      if (!groupedByApartment[key]) {
                        groupedByApartment[key] = [];
                      }
                      groupedByApartment[key].push(res);
                    });

                    return Object.entries(groupedByApartment).map(([aptKey, residentsList]) => (
                      <div key={aptKey} className="bg-dark-input/20 border border-dark-border/40 p-3 rounded-xl space-y-2">
                        <h4 className="text-xs font-semibold text-gold font-display flex items-center gap-1 border-b border-dark-border/30 pb-1">
                          <Building size={12} /> {aptKey}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {residentsList.map((res) => (
                            <button
                              key={res.id}
                              onClick={() => setSelectedNotRegisteredResident(res)}
                              className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer border ${selectedNotRegisteredResident?.id === res.id ? 'bg-purple-600/15 border-purple-500/40 text-white' : 'hover:bg-dark-hover/70 text-zinc-350 border-transparent'}`}
                            >
                              <span className="font-semibold font-display truncate">{res.name}</span>
                              <ChevronRight size={13} className={selectedNotRegisteredResident?.id === res.id ? 'text-purple-400' : 'text-zinc-600'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* RIGHT COLUMN: PREVIEW & DETAILS CARD */}
                <div>
                  {selectedNotRegisteredResident ? (
                    <div className="bg-dark-input/20 border border-dark-border rounded-xl p-5 space-y-5 sticky top-2">
                      <div className="text-center">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-950/40 border border-purple-900/50 px-3 py-1 rounded-full">
                          Ficha de Cadastro Manual
                        </span>
                      </div>

                      {/* Photo preview with scanlines overlay */}
                      <div className="relative aspect-square w-44 mx-auto rounded-xl overflow-hidden border border-purple-500/30 bg-black flex items-center justify-center group shadow-xl shadow-black/50">
                        <img
                          src={selectedNotRegisteredResident.photoDataUrl}
                          alt={selectedNotRegisteredResident.name}
                          className="w-full h-full object-cover scale-x-[-1]"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      </div>

                      <div className="space-y-3.5 text-center">
                        <div>
                          <h3 className="font-display font-bold text-white text-base leading-snug">{selectedNotRegisteredResident.name}</h3>
                          <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase mt-1">
                            Apto {selectedNotRegisteredResident.apartment} {selectedNotRegisteredResident.block && selectedNotRegisteredResident.block !== 'Único' ? `— Bloco ${selectedNotRegisteredResident.block}` : ''}
                          </p>
                        </div>
                        
                        <div className="p-3 bg-zinc-950/40 rounded-lg text-left text-[11px] text-zinc-400 leading-relaxed font-sans space-y-1.5 border border-dark-border/30">
                          <p className="font-semibold text-zinc-300">Como finalizar o cadastro facial físico:</p>
                          <ol className="list-decimal pl-4 space-y-1">
                            <li>Baixe a foto facial do morador clicando abaixo;</li>
                            <li>Importe-a na memória ou software do leitor de reconhecimento facial físico;</li>
                            <li>Após cadastrar, marque como finalizado para remover o morador desta pendência.</li>
                          </ol>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1 select-none">
                        <button
                          onClick={() => handleDownloadPhoto(selectedNotRegisteredResident)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20 font-display"
                        >
                          <Download size={14} /> Baixar Foto do Morador
                        </button>
                        <button
                          onClick={() => handleToggleDeviceRegistered(selectedNotRegisteredResident.id, false)}
                          className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/20 font-display"
                        >
                          <CheckCircle2 size={14} /> Confirmar Cadastro no Aparelho
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-dark-border rounded-xl flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                      <ShieldAlert size={36} className="text-zinc-600 mb-2" />
                      <p className="text-xs font-display">Selecione um morador na lista para visualizar a ficha de cadastro manual.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-dark-border text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider">
                    <th className="py-3 px-2">Morador</th>
                    <th className="py-3 px-2">Unidade</th>
                    <th className="py-3 px-2">Facial</th>
                    <th className="py-3 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {displayResidents.map((resident) => (
                    <tr key={resident.id} className="hover:bg-dark-hover/40 text-xs transition-colors">
                      <td className="py-3 px-2 font-medium text-zinc-100 font-display">
                        {resident.name}
                      </td>
                      <td className="py-3 px-2 text-zinc-400 font-mono text-[11px]">
                        Apto {resident.apartment} {resident.block && resident.block !== 'Único' ? `/ ${resident.block}` : ''}
                      </td>
                      <td className="py-3 px-2">
                        {resident.photoDataUrl ? (
                          <span className="px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[10px] rounded-full font-semibold uppercase tracking-wide select-none">
                            Com Foto
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded-full font-medium uppercase tracking-wide select-none">
                            Sem Foto
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right select-none">
                        <div className="inline-flex items-center gap-1.5">
                          {resident.photoDataUrl && (
                            <button
                              id={`admin-view-photo-${resident.id}`}
                              onClick={() => setPreviewPhoto({ name: resident.name, url: resident.photoDataUrl! })}
                              className="p-1 px-2.5 bg-dark-input hover:bg-dark-hover border border-dark-border rounded-lg text-zinc-300 font-medium cursor-pointer transition-colors flex items-center gap-1 text-[11px] font-display"
                            >
                              <Eye size={12} /> Ver
                            </button>
                          )}
                          <button
                            title="Redefinir senha do morador"
                            onClick={() => setResettingResidentId(resident.id)}
                            className="p-1.5 text-zinc-500 hover:text-yellow-400 hover:bg-yellow-950/30 rounded-lg cursor-pointer transition-colors"
                          >
                            <KeyRound size={13} />
                          </button>
                          <button
                            id={`admin-delete-res-${resident.id}`}
                            onClick={() => handleDeleteResident(resident.id, resident.name)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {adminSubTab === 'reservas' && (
        <ReservationSection resident={null} isAdmin={true} />
      )}

      {adminSubTab === 'funcionarios' && (
        <div className="space-y-6">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold text-white text-base">Funcionários Cadastrados</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Gerencie as contas dos funcionários (porteiros) autorizados a acessar a portaria física e receber encomendas.
                </p>
              </div>
            </div>

            {employeeError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-900/40 text-red-400 text-xs rounded-xl font-medium">
                {employeeError}
              </div>
            )}

            {employeeSuccess && (
              <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-xs rounded-xl font-medium">
                {employeeSuccess}
              </div>
            )}

            {/* Form to add employee */}
            <form onSubmit={handleAddEmployee} className="mt-6 p-4 bg-dark-input/50 border border-dark-border/60 rounded-xl space-y-4">
              <h4 className="text-xs font-bold font-display text-zinc-300 uppercase tracking-wider">Cadastrar Novo Funcionário</h4>
              <div className="flex gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block font-display">Nome do Funcionário *</label>
                  <input
                    type="text"
                    required
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="Ex: Porteiro Silva"
                    className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20 text-white placeholder-zinc-600"
                  />
                </div>
                <div className="flex items-end select-none">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gold hover:bg-gold-hover text-black font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-gold/10 cursor-pointer"
                  >
                    Salvar Cadastro
                  </button>
                </div>
              </div>
            </form>

            {/* List Employees */}
            <div className="mt-6 border border-dark-border rounded-xl overflow-hidden bg-dark-input/20">
              {loadingEmployees && employees.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin text-gold font-bold">...</div>
                  <p>Buscando funcionários cadastrados...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-dark-input border-b border-dark-border text-zinc-400 font-semibold font-display tracking-tight text-[11px] select-none uppercase font-mono">
                        <th className="py-3 px-4">Foto</th>
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-dark-hover/30 transition-colors">
                          <td className="py-3.5 px-4 w-12">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-lg bg-dark-input border border-dark-border overflow-hidden flex items-center justify-center">
                                {emp.photoDataUrl ? (
                                  <img src={emp.photoDataUrl} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Users size={16} className="text-zinc-600" />
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-display font-semibold text-white">
                            {emp.name}
                            {emp.needsPasswordSet && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] rounded font-mono uppercase">Sem Senha</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                             <button
                               type="button"
                               onClick={() => setResettingEmployeeId(emp.id)}
                               className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent text-[11px] font-semibold rounded-lg transition-all cursor-pointer font-sans"
                             >
                               Resetar Senha
                             </button>
                            <button
                              type="button"
                              onClick={() => handleStartDeleteEmployee(emp.id)}
                              className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent text-[11px] font-semibold rounded-lg transition-all cursor-pointer font-sans"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-12 text-center text-zinc-500 text-xs font-sans">
                            Nenhum funcionário cadastrado no sistema.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {adminSubTab === 'calendario' && (
        <ReservationCalendar reservations={reservations} areas={commonAreas} />
      )}

      {adminSubTab === 'areas' && (
        <AdminAreasPanel />
      )}

      {adminSubTab === 'whatsapp' && (
        <WhatsAppPanel />
      )}

      {adminSubTab === 'hikvision' && (
        <HikvisionPanel />
      )}

      {adminSubTab === 'prestadores' && (
        <div className="space-y-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-white text-base">Prestadores de Serviço</h3>
                <p className="text-xs text-zinc-500 mt-1">Visualize todos os prestadores cadastrados pelos moradores e sincronize com os terminais Hikvision.</p>
              </div>
              <button
                onClick={fetchProviders}
                className="p-2 rounded-lg border border-dark-border text-zinc-400 hover:text-white bg-dark-input hover:bg-dark-hover transition-all cursor-pointer"
                title="Atualizar"
              >
                <RefreshCw size={13} className={loadingProviders ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingProviders && providers.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-zinc-500 text-xs">
                <RefreshCw size={18} className="animate-spin text-gold" /> Carregando...
              </div>
            ) : providers.length === 0 ? (
              <div className="py-10 text-center text-zinc-500 text-xs bg-dark-input/30 border border-dark-border/40 rounded-xl">
                Nenhum prestador cadastrado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map(p => {
                  const expired = new Date(p.accessExpiry) < new Date();
                  const hasPhoto = !!p.photoDataUrl;
                  const hikStatus = p.hikvisionSyncStatus || {};
                  const allSynced = hasPhoto && Object.keys(hikStatus).length > 0 && Object.values(hikStatus).every((s: any) => s.status === 'synced');
                  return (
                    <div key={p.id} className="flex items-center gap-4 p-4 bg-dark-input/50 border border-dark-border/50 rounded-xl">
                      {/* Photo */}
                      <div className="w-12 h-12 rounded-full border border-dark-border overflow-hidden bg-zinc-900 shrink-0 flex items-center justify-center">
                        {hasPhoto
                          ? <img src={p.photoDataUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          : <span className="text-zinc-600 text-[10px] text-center leading-tight font-mono px-1">Sem foto</span>}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                        <p className="text-[11px] text-zinc-400">{p.serviceType} — Apto {p.apartment}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">Morador: {p.residentName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {expired ? (
                            <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Expirado</span>
                          ) : p.status === 'registered' ? (
                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Ativo até {new Date(p.accessExpiry).toLocaleDateString('pt-BR')}</span>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Aguardando foto</span>
                          )}
                          {hasPhoto && (
                            allSynced
                              ? <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">• Hik: Sincronizado</span>
                              : <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">• Hik: Pendente</span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {hasPhoto && (
                          <button
                            onClick={() => syncProviderToHikvision(p)}
                            disabled={syncingProviderId === p.id}
                            title="Sincronizar com Hikvision"
                            className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-400 text-[10px] font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            {syncingProviderId === p.id
                              ? <RefreshCw size={11} className="animate-spin" />
                              : <FolderSync size={11} />}
                            Sync
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingProviderId(p.id)}
                          title="Remover prestador"
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/10 rounded-lg cursor-pointer transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider delete confirmation */}
      <AnimatePresence>
        {deletingProviderId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingProviderId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-red-400">
                <Trash2 size={22} />
                <h3 className="font-display font-bold text-base text-white">Remover Prestador</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Deseja remover este prestador? O acesso facial será cancelado nos terminais.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeletingProviderId(null)} className="px-3 py-1.5 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer">
                  Cancelar
                </button>
                <button onClick={() => deleteProvider(deletingProviderId)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-xs font-semibold text-white rounded-lg cursor-pointer">
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOM DELETE CONFIRMATION MODAL OVERLAY */}
      <AnimatePresence>
        {deletingResidentId && (
          <motion.div
            id="admin-delete-confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setDeletingResidentId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <ShieldAlert size={28} />
                <h3 className="font-display font-bold text-lg text-white">Confirmar Exclusão</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente excluir o morador permanentemente? Esta ação apagará também suas fotos e reservas associadas de forma irreversível.
              </p>
              <div className="flex gap-2.5 pt-2 select-none justify-end">
                <button
                  onClick={() => setDeletingResidentId(null)}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  id="admin-confirm-delete-btn"
                  onClick={() => confirmDeleteResident(deletingResidentId)}
                  className="px-4 py-2 bg-red-650 hover:bg-red-600 border border-red-900/20 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-display"
                >
                  <Trash2 size={13} /> Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {resettingResidentId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => { setResettingResidentId(null); setResidentResetPassword(''); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-2xl max-w-sm w-full flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-yellow-400">
                <KeyRound size={24} />
                <h3 className="font-display font-bold text-base text-white">Redefinir Senha do Morador</h3>
              </div>
              {(() => { const r = residents.find(x => x.id === resettingResidentId); return r ? (
                <p className="text-xs text-zinc-400">{r.name} — Apto {r.apartment} / {r.block || 'Único'}</p>
              ) : null; })()}
              <div className="space-y-2">
                <input
                  type="text"
                  value={residentResetUsername}
                  onChange={e => setResidentResetUsername(e.target.value)}
                  placeholder="Novo usuário (opcional — deixe vazio para manter)"
                  className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500 placeholder-zinc-600"
                />
                <input
                  type="password"
                  value={residentResetPassword}
                  onChange={e => setResidentResetPassword(e.target.value)}
                  placeholder="Nova senha (mín. 4 caracteres)"
                  className="w-full bg-dark-input border border-dark-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500 placeholder-zinc-600"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setResettingResidentId(null); setResidentResetPassword(''); setResidentResetUsername(''); }}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors"
                >Cancelar</button>
                <button
                  onClick={() => residentResetPassword.length >= 4 && handleResetResidentPassword(resettingResidentId!, residentResetPassword, residentResetUsername || undefined)}
                  disabled={residentResetPassword.length < 4}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 disabled:opacity-40"
                >
                  <KeyRound size={13} /> Redefinir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {deletingEmployeeId && (
          <motion.div
            id="admin-delete-employee-confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setDeletingEmployeeId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-red-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <ShieldAlert size={28} />
                <h3 className="font-display font-bold text-lg text-white">Confirmar Exclusão</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente excluir este funcionário permanentemente? Esta ação é irreversível.
              </p>
              <div className="flex gap-2.5 pt-2 select-none justify-end">
                <button
                  onClick={() => setDeletingEmployeeId(null)}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDeleteEmployee(deletingEmployeeId)}
                  className="px-4 py-2 bg-red-650 hover:bg-red-600 border border-red-900/20 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-display"
                >
                  <Trash2 size={13} /> Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {resettingEmployeeId && (
          <motion.div
            id="admin-reset-password-confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setResettingEmployeeId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-blue-900/40 rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-blue-400">
                <RotateCcw size={28} />
                <h3 className="font-display font-bold text-lg text-white">Resetar Senha</h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans select-text">
                Deseja realmente resetar a senha deste funcionário? Ele deverá escolher uma nova senha ao entrar no sistema.
              </p>
              <div className="flex gap-2.5 pt-2 select-none justify-end">
                <button
                  onClick={() => setResettingEmployeeId(null)}
                  className="px-4 py-2 bg-dark-input hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-400 rounded-lg cursor-pointer transition-colors font-display"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleResetEmployeePassword(resettingEmployeeId)}
                  className="px-4 py-2 bg-blue-650 hover:bg-blue-600 border border-blue-900/20 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors flex items-center gap-1 font-display"
                >
                  Confirmar Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHOTO PREVIEW MODAL OVERLAY */}
      <AnimatePresence>
        {previewPhoto && (
          <motion.div
            id="admin-photo-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-3 right-3 z-10">
                <button
                  id="admin-modal-close"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-2 bg-black/75 text-white hover:bg-black rounded-full cursor-pointer transition-colors border border-white/5"
                >
                  <RefreshCw size={14} className="rotate-45" />
                </button>
              </div>

              <div className="aspect-square relative bg-neutral-900 flex items-center justify-center">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.name}
                  className="w-full h-full object-cover scale-x-[-1]"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-5 select-text">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-gold" />
                  <h4 className="font-display font-semibold text-zinc-300 text-sm">Validado por Cadastro Facial</h4>
                </div>
                <h3 className="font-display font-bold text-white text-lg mt-2 truncate">{previewPhoto.name}</h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">FOTO REGISTRADA EM TEMPO REAL</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
