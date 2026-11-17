import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Salonéo ErrorBoundary:', error, info);
  }

  private getFriendlyMessage(raw: string): string {
    if (raw.includes('Quota exceeded')) {
      return 'Le quota journalier gratuit de la base de données est atteint. Il sera réinitialisé demain.';
    }
    if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
      return "Accès refusé aux données du salon. Vérifiez que vous êtes connecté avec le bon compte.";
    }
    return "Une erreur technique s'est produite. Veuillez recharger la page.";
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#EBE4F2] p-8 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#FBF4DE] text-[#A87E15] flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-[#23093A] mb-3">
              Oups, quelque chose a bloqué
            </h1>
            <p className="text-sm text-[#5E526B] leading-relaxed mb-6">
              {this.getFriendlyMessage(this.state.message)}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-[#4C1D95] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B0764] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
