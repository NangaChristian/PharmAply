import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function PatientPrivacy() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10 flex items-center gap-4">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-indigo-900 border border-gray-100 rounded-full bg-white shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} />
         </button>
         <h1 className="font-bold text-gray-900 text-xl">{t('privacy_security', 'Privacy & Security')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
               <Shield className="text-green-500" size={20} /> {t('security_settings', 'Security Settings')}
            </h2>
            <div className="space-y-4">
               <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                  <div>
                     <h3 className="font-bold text-sm text-gray-900">{t('change_password', 'Change Password')}</h3>
                     <p className="text-xs text-gray-500 mt-1">{t('change_password_desc', 'Update your account password')}</p>
                  </div>
                  <button className="text-sm font-bold text-indigo-600">{t('update', 'Update')}</button>
               </div>
               
               <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                  <div>
                     <h3 className="font-bold text-sm text-gray-900">{t('two_factor', 'Two-Factor Authentication')}</h3>
                     <p className="text-xs text-gray-500 mt-1">{t('two_factor_desc', 'Add an extra layer of security')}</p>
                  </div>
                  <div className="w-10 h-6 bg-gray-200 rounded-full relative cursor-pointer">
                     <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1 shadow-sm"></div>
                  </div>
               </div>
            </div>
         </div>
         
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-900 mb-4">{t('privacy_policy', 'Privacy Policy')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
               {t('privacy_policy_1', 'Welcome to our healthcare platform. We prioritize your privacy and comply with strict health data regulations to protect your information. Your medical data, including prescriptions and consultation notes, are encrypted and accessible only by you and the medical professionals you choose.')}
               <br/><br/>
               {t('privacy_policy_2', 'We do not share your personal health information with unauthorized third parties without your explicit consent, except when required by law.')}
            </p>
         </div>
      </div>
    </div>
  );
}
