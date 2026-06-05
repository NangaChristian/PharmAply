import React, { useState, useRef } from "react";
import { ArrowLeft, Camera, Upload, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from '../../lib/firebase';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";

import { fetchApi } from '../../lib/apiClient';

export function PatientPrescriptionUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<'upload' | 'success'>('upload');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        alert(t('invalid_file_type', 'Invalid file type. Only PDF and JPG are allowed.'));
        return;
      }

      setUploading(true);
      setProgress(0);
      
      try {
        let fileUrl = '';
        try {
          const fileRef = ref(storage, `prescriptions/${user.uid}/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(fileRef, file);
          
          fileUrl = await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setProgress(p);
              },
              (error) => reject(error),
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              }
            );
          });
        } catch (storageErr: any) {
          console.error("Storage upload failed:", storageErr);
          throw storageErr;
        }

        const presDoc = await addDoc(collection(db, 'prescriptions'), {
           patientId: user.uid,
           fileUrl: fileUrl,
           fileName: file.name,
           status: 'pending_review',
           createdAt: serverTimestamp()
        });

        // Backend AI OCR Logic
        try {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async () => {
             const resultString = reader.result as string; 
             const base64Data = resultString.split(',')[1];
             const ocrRes = await fetchApi('/api/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Data, mimeType: file.type })
             });
             const ocrJson = await ocrRes.json();
             if (ocrJson.success) {
                await addDoc(collection(db, 'prescription_scans'), {
                   patientId: user.uid,
                   prescriptionId: presDoc.id,
                   mappedItems: ocrJson.data,
                   createdAt: serverTimestamp()
                });
             }
          };
        } catch (ocrErr) {
           console.warn("AI OCR mapping failed", ocrErr);
        }

        try {
          await addDoc(collection(db, 'notifications'), {
            userId: 'ADMIN',
            type: 'prescription_uploaded',
            title: 'New Prescription Uploaded',
            message: `A new prescription is awaiting review.`,
            isRead: false,
            relatedId: presDoc.id,
            createdAt: serverTimestamp()
          });
        } catch(e) {
          console.warn("Could not notify admin", e);
        }

        setStep('success');
      } catch (err: any) {
        console.error("Upload error:", err);
        alert(err.message || t('profile_upload_failed', "Failed to upload prescription."));
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-white dark:bg-black shadow-sm z-10">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full">
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-lg">{t('send_prescription', 'Send Prescription')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          {step === 'upload' ? (
             <div className="flex-1 flex flex-col">
                <p className="text-sm text-gray-600 mb-6">
                   {t('upload_prescription_desc', 'Upload a clear picture or PDF of your prescription. A pharmacist will review it and provide a quote.')}
                </p>

                <div className="flex-1 grid grid-cols-1 gap-4 max-h-64">
                   <input 
                     type="file" 
                     className="hidden" 
                     ref={fileInputRef} 
                     accept="image/*,.pdf"
                     onChange={handleFileChange}
                   />
                   <button 
                     disabled={uploading}
                     onClick={() => fileInputRef.current?.click()} 
                     className="bg-white dark:bg-black border-2 border-dashed border-indigo-200 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-indigo-50 transition text-indigo-600 disabled:opacity-50 overflow-hidden relative"
                   >
                      {uploading ? (
                         <div className="flex flex-col items-center w-full px-8">
                            <Loader2 size={32} className="animate-spin mb-3" />
                            <span className="font-bold mb-2">{t('uploading', 'Uploading...')} {Math.round(progress)}%</span>
                            <div className="w-full bg-indigo-100 rounded-full h-2.5">
                              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                         </div>
                      ) : (
                         <>
                            <Upload size={32} />
                            <span className="font-bold">{t('upload_file_btn', 'Upload File (PDF/JPG)')}</span>
                         </>
                      )}
                   </button>
                </div>
             </div>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                   <CheckCircle size={40} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('prescription_sent', 'Prescription Sent!')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-8 max-w-[250px]">
                   {t('prescription_sent_desc', 'The pharmacy is reviewing your prescription. You will receive a quote shortly.')}
                </p>
                <div className="w-full space-y-3">
                   <button 
                     onClick={() => navigate('/patient')} 
                     className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200"
                   >
                      {t('return_to_home', 'Return to Home')}
                   </button>
                   <button 
                     onClick={() => navigate('/patient/orders')} 
                     className="w-full bg-slate-200 text-slate-800 dark:text-slate-100 font-bold py-4 rounded-xl"
                   >
                      {t('view_orders', 'View Orders')}
                   </button>
                </div>
             </div>
          )}
      </div>
    </div>
  );
}
