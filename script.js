const fs = require('fs');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('useTranslation')) {
    content = content.replace(/(import.*?;?\n)/, '$1import { useTranslation } from "react-i18next";\n');
  }

  // insert const { t } = useTranslation();
  if (!content.includes('const { t } = useTranslation()')) {
    content = content.replace(/(export function \w+\(.*?\)\s*\{)/, '$1\n  const { t } = useTranslation();');
  }
  
  // Custom replaces for AdminUsers:
  if (filePath.includes('Users.tsx')) {
    content = content.replace(/Gestion Vendeurs/, "{t('admin_manage_vendors', 'Gestion Vendeurs')}");
    content = content.replace(/Gestion Clients/, "{t('admin_manage_clients', 'Gestion Clients')}");
    content = content.replace(/Gestion Livreurs/, "{t('admin_manage_drivers', 'Gestion Livreurs')}");
    content = content.replace(/Gestion Caissiers/, "{t('admin_manage_cashiers', 'Gestion Caissiers')}");
    content = content.replace(/Users & Entities/, "{t('admin_users_entities', 'Users & Entities')}");
    
    content = content.replace(/'Pending KYC'/g, "t('status_pending_kyc', 'Pending KYC')");
    content = content.replace(/'Suspended'/g, "t('status_suspended', 'Suspended')");
    content = content.replace(/'Active'/g, "t('status_active', 'Active')");
    
    content = content.replace(/>Profiles</g, ">{t('profiles', 'Profiles')}<");
    content = content.replace(/>KYC Approvals/g, ">{t('kyc_approvals', 'KYC Approvals')}");
    content = content.replace(/placeholder="Search users..."/g, "placeholder={t('search_users', 'Search users...')}");
    
    content = content.replace(/>All Status</g, ">{t('all_status', 'All Status')}<");
    content = content.replace(/>All Roles</g, ">{t('all_roles', 'All Roles')}<");
    content = content.replace(/>Patient</g, ">{t('role_patient', 'Patient')}<");
    content = content.replace(/>Pharmacy</g, ">{t('role_pharmacy', 'Pharmacy')}<");
    content = content.replace(/>Driver</g, ">{t('role_driver', 'Driver')}<");
    content = content.replace(/>Admin</g, ">{t('role_admin', 'Admin')}<");
    content = content.replace(/>Cashier</g, ">{t('role_cashier', 'Cashier')}<");
    content = content.replace(/selected selected/g, "selected selected"); // dummy
    content = content.replace(/>User</g, ">{t('user_label', 'User')}<");
    content = content.replace(/>Role</g, ">{t('role_label', 'Role')}<");
    content = content.replace(/>Status</g, ">{t('status_label', 'Status')}<");
    content = content.replace(/>Joined</g, ">{t('joined_label', 'Joined')}<");
    content = content.replace(/>Actions</g, ">{t('actions_label', 'Actions')}<");
    content = content.replace(/>Loading users...</g, ">{t('loading_users', 'Loading users...')}<");
    content = content.replace(/>No users found.</g, ">{t('no_users_found', 'No users found.')}<");
    content = content.replace(/>Unknown User</g, ">{t('unknown_user', 'Unknown User')}<");
    content = content.replace(/>Pending Background Checks</g, ">{t('pending_bg_checks', 'Pending Background Checks')}<");
    content = content.replace(/>Loading...</g, ">{t('loading', 'Loading...')}<");
    content = content.replace(/>All operations have been reviewed.</g, ">{t('all_operations_reviewed', 'All operations have been reviewed.')}<");
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

const filesToProcess = [
  'src/pages/admin/Users.tsx',
];

filesToProcess.forEach(processFile);
console.log('Done Users.tsx');
