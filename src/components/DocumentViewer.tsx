import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface DocumentViewerProps {
  filePath: string | null;
  bucket?: string;
  onClose: () => void;
}

export function DocumentViewer({ filePath, bucket = 'drivers', onClose }: DocumentViewerProps) {
  const { t } = useTranslation();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    
    // If it's already a full HTTP URL, just use it
    if (filePath.startsWith('http')) {
      setSignedUrl(filePath);
      return;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600); // 1 hour expiry
        
        if (error) {
           throw error;
        }
        
        if (data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      } catch (e: any) {
        toast.error("Erreur lors de la récupération du document: " + e.message);
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [filePath, bucket]);

  if (!filePath) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold text-xl drop-shadow-md"> {t('document_verification', 'Document Verification')} </h3>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center min-h-[50vh]">
          {loading ? (
             <div className="flex flex-col items-center justify-center text-white p-12">
                <Loader2 className="animate-spin mb-4" size={48} />
                <span className="text-lg">Chargement du document sécurisé...</span>
             </div>
          ) : signedUrl ? (
            signedUrl.toLowerCase().includes('.pdf') ? (
              <iframe src={`${signedUrl}#toolbar=0`} className="w-full h-[80vh] rounded-2xl bg-white" title={t('document_viewer', 'Document Viewer')} />
            ) : (
              <img src={signedUrl} alt="Document View" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            )
          ) : (
            <div className="text-white">Impossible de charger le document.</div>
          )}
        </div>
        
        {signedUrl && (
            <div className="mt-4 flex justify-between gap-4">
               <a 
                 href={signedUrl} 
                 target="_blank" 
                 rel="noreferrer" 
                 className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white text-center font-bold rounded-xl transition backdrop-blur-md border border-white/10"
               >
                  {t('open_in_new_tab', 'Open in New Tab')} 
               </a>
            </div>
        )}
      </div>
    </div>
  );
}
