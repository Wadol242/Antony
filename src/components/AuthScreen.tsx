import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail, Scissors, Sparkles } from 'lucide-react';
import { auth } from '../firebase';

type AuthMode = 'login' | 'signup' | 'reset';

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return "L'adresse e-mail n'est pas valide.";
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet e-mail. Connectez-vous.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/operation-not-allowed':
      return "La connexion par e-mail et mot de passe n'est pas encore activée dans la console Firebase (Authentication > Sign-in method).";
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion internet.';
    default:
      return 'Impossible de finaliser la connexion. Veuillez réessayer.';
  }
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Veuillez saisir votre adresse e-mail.');
      return;
    }

    if (mode === 'reset') {
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        setInfoMessage(
          'Un e-mail de réinitialisation a été envoyé si ce compte existe. Vérifiez votre boîte de réception.'
        );
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? '';
        setError(mapAuthError(code));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      setError(mapAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8FC] flex flex-col lg:grid lg:grid-cols-12">
      {/* Left editorial panel (visible on desktop, compact banner on mobile) */}
      <div className="relative lg:col-span-6 xl:col-span-7 bg-[#23093A] text-white overflow-hidden flex flex-col justify-between min-h-[210px] lg:min-h-screen">
        {!imageFailed ? (
          <img
            src="/src/assets/images/salon_welcome_1794901772948.jpg"
            alt="Intérieur d'un salon de coiffure moderne à Brazzaville"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#3B0764] via-[#23093A] to-[#1A052C]" />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#23093A] via-[#23093A]/55 to-[#23093A]/30"
          aria-hidden="true"
        />

        <div className="relative z-10 p-6 sm:p-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#C89B2B] text-[#23093A] flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-white">
              Salonéo
            </span>
          </div>
          <span className="text-xs font-medium text-[#FBF4DE]/90">Congo-Brazzaville</span>
        </div>

        <div className="relative z-10 p-6 sm:p-10 lg:pb-14 max-w-xl">
          <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-white mb-3">
            Gérez votre salon avec sérénité
          </h1>
          <p className="text-sm sm:text-base text-[#EAE2F3] leading-relaxed">
            Rendez-vous du jour, fichier clients, tarifs en FCFA et horaires : tout votre salon
            dans un outil simple, pensé pour votre téléphone.
          </p>
        </div>
      </div>

      {/* Right authentication card */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#EBE4F2] p-6 sm:p-8 shadow-sm">
          {/* Mode selector */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3ECFA] rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setInfoMessage('');
                }}
                className={`min-h-[44px] px-3 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white text-[#23093A] shadow-sm'
                    : 'text-[#5E526B] hover:text-[#23093A]'
                }`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setInfoMessage('');
                }}
                className={`min-h-[44px] px-3 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-white text-[#23093A] shadow-sm'
                    : 'text-[#5E526B] hover:text-[#23093A]'
                }`}
              >
                Créer un compte
              </button>
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-display text-2xl font-semibold text-[#23093A] mb-1">
              {mode === 'login' && 'Bon retour'}
              {mode === 'signup' && 'Ouvrir votre espace salon'}
              {mode === 'reset' && 'Mot de passe oublié'}
            </h2>
            <p className="text-sm text-[#5E526B]">
              {mode === 'login' && 'Accédez au planning et aux fiches clients de votre salon.'}
              {mode === 'signup' && 'Chaque compte gère un salon privé avec ses propres données.'}
              {mode === 'reset' &&
                'Saisissez votre e-mail pour recevoir un lien de réinitialisation.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-[#F2C6C6] bg-[#FDF2F2] px-4 py-3 text-sm text-[#991B1B]"
            >
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 rounded-2xl border border-[#E6D6A6] bg-[#FBF4DE] px-4 py-3 text-sm text-[#6E5109]">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-[#2D1F3D] mb-1.5">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patronne@monsalon.cg"
                  className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-sm font-medium text-[#2D1F3D] mb-1.5"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full min-h-[48px] pl-11 pr-12 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                    }
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-[#6E5F7F] hover:text-[#23093A]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm"
                  className="block text-sm font-medium text-[#2D1F3D] mb-1.5"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-[#7E6F8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez votre mot de passe"
                    className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-2xl border border-[#DFD5EA] bg-[#FAF8FC] text-base text-[#1F1629] placeholder:text-[#9689A6] focus:outline-none focus:border-[#4C1D95] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#4C1D95] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#3B0764] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {loading ? (
                <span>Veuillez patienter…</span>
              ) : (
                <>
                  {mode === 'login' && <span>Se connecter</span>}
                  {mode === 'signup' && (
                    <>
                      <Sparkles className="w-5 h-5 text-[#DFB54B]" />
                      <span>Créer mon compte salon</span>
                    </>
                  )}
                  {mode === 'reset' && <span>Envoyer le lien</span>}
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#F1ECF6] text-center">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setInfoMessage('');
                }}
                className="text-sm font-medium text-[#4C1D95] hover:underline min-h-[44px] px-3"
              >
                Mot de passe oublié ?
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setInfoMessage('');
                }}
                className="text-sm font-medium text-[#4C1D95] hover:underline min-h-[44px] px-3"
              >
                Retour à la connexion
              </button>
            )}
            {mode === 'signup' && (
              <p className="text-xs text-[#6E5F7F]">
                Vos données clients et recettes restent strictement privées sur votre compte.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
