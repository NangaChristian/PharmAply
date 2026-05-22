/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleLayout } from './components/layout/RoleLayout';
import { Onboarding } from './pages/auth/Onboarding';
import { PharmacistRegistration } from './pages/auth/PharmacistRegistration';
import { DriverRegistration } from './pages/auth/DriverRegistration';
import { ForgetPassword } from './pages/auth/ForgetPassword';

import { PatientHome } from './pages/patient/Home';
import { PatientSearch } from './pages/patient/Search';
import { PatientProductDetails } from './pages/patient/ProductDetails';
import { PatientPharmacyDetails } from './pages/patient/PharmacyDetails';
import { PatientCheckout } from './pages/patient/Checkout';
import { PatientTracking } from './pages/patient/Tracking';
import { PatientPrescriptionUpload } from './pages/patient/PrescriptionUpload';
import { Messages } from './pages/patient/Messages';
import { PatientNotifications } from './pages/patient/Notifications';
import { PatientReminders } from './pages/patient/Reminders';
import { PatientCart } from './pages/patient/Cart';
import { PatientOrders } from './pages/patient/Orders';
import { PatientPrescriptions } from './pages/patient/Prescriptions';
import { PatientProfile } from './pages/patient/Profile';
import { PatientPaymentMethods } from './pages/patient/PaymentMethods';
import { PatientWishlist } from './pages/patient/Wishlist';
import { PatientPrivacy } from './pages/patient/Privacy';

import { PharmacistHome } from './pages/pharmacist/Home';
import { PharmacistOrderDetails } from './pages/pharmacist/OrderDetails';
import { PharmacistProductDetails } from './pages/pharmacist/ProductDetails';
import { PharmacistInventory } from './pages/pharmacist/Inventory';
import { PharmacistOrders } from './pages/pharmacist/Orders';
import { PharmacistReports } from './pages/pharmacist/Reports';
import { PharmacistProfile } from './pages/pharmacist/Profile';
import { PharmacistPrescriptions } from './pages/pharmacist/Prescriptions';

import { DeliveryHome } from './pages/delivery/Home';
import { DeliveryOrderDetails } from './pages/delivery/OrderDetails';
import { DeliveryHistory } from './pages/delivery/History';
import { DeliveryActive } from './pages/delivery/Active';
import { DeliveryProfile } from './pages/delivery/Profile';

import { AdminLayout } from './components/layout/AdminLayout';
import { AdminLogin } from './pages/admin/Login';

import { AdminHome } from './pages/admin/Home';
import { AdminUsers } from './pages/admin/Users';
import { AdminFinances } from './pages/admin/Finances';
import { AdminSettings } from './pages/admin/Settings';
import { AdminOrders } from './pages/admin/Orders';
import { AdminProducts } from './pages/admin/Products';
import { AdminAuditLogs } from './pages/admin/AuditLogs';
import { AdminCategories } from './pages/admin/Categories';
import { AdminSupport } from './pages/admin/Support';
import { AdminProfile } from './pages/admin/Profile';
import { AdminDocumentation } from './pages/admin/Documentation';
import { AdminChangelog } from './pages/admin/Changelog';
import { AdminReports } from './pages/admin/Reports';
import { AppSettings } from './pages/admin/settings/AppSettings';
import { WebsiteSettings } from './pages/admin/settings/WebsiteSettings';
import { DeliveryZones } from './pages/admin/settings/DeliveryZones';
import { ThemeSettings } from './pages/admin/settings/ThemeSettings';
import { ThemeProvider } from './components/ThemeProvider';
import { Promotions } from './pages/admin/settings/Promotions';
import { Compliance } from './pages/admin/settings/Compliance';
import { SecurityRoles } from './pages/admin/settings/SecurityRoles';
import { GlobalSettings } from './pages/admin/settings/GlobalSettings';
import { FinancialSettings } from './pages/admin/settings/FinancialSettings';
import { VendorSettings } from './pages/admin/settings/VendorSettings';
import { CatalogSettings } from './pages/admin/settings/CatalogSettings';

import { PatientSettings } from './pages/patient/Settings';
import { PatientProfileDetails } from './pages/patient/ProfileDetails';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center text-gray-500 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p>This screen is mapped out for future implementation.</p>
    </div>
  );
}

import { DarkModeProvider } from './components/DarkModeProvider';
import { AppUpdater } from './components/AppUpdater';

export default function App() {
  return (
    <DarkModeProvider>
      <ThemeProvider>
        <AppUpdater>
        <BrowserRouter>
          <AppShell>

          <Routes>
          <Route path="/" element={<Onboarding />} />
          <Route path="/forget-password" element={<ForgetPassword />} />
          <Route path="/pharmacist-registration" element={<PharmacistRegistration />} />
          <Route path="/driver-registration" element={<DriverRegistration />} />

          {/* Patient Routes - Within BottomNav layout */}
          <Route path="/patient" element={<RoleLayout role="patient" />}>
            <Route index element={<PatientHome />} />
            <Route path="orders" element={<PatientOrders />} />
            <Route path="calendar" element={<PatientReminders />} />
            <Route path="cart" element={<PatientCart />} />
            <Route path="profile" element={<PatientProfile />} />
            <Route path="search" element={<PatientSearch />} />
            <Route path="notifications" element={<PatientNotifications />} />
            <Route path="settings" element={<PatientSettings />} />
            <Route path="profile/details" element={<PatientProfileDetails />} />
            <Route path="prescriptions" element={<PatientPrescriptions />} />
            <Route path="product/:id" element={<PatientProductDetails />} />
            <Route path="pharmacy/:id" element={<PatientPharmacyDetails />} />
            <Route path="checkout/:id" element={<PatientCheckout />} />
            <Route path="tracking/:id" element={<PatientTracking />} />
            <Route path="messages/:id" element={<Messages />} />
            <Route path="prescription-upload" element={<PatientPrescriptionUpload />} />
            <Route path="payment-methods" element={<PatientPaymentMethods />} />
            <Route path="wishlist" element={<PatientWishlist />} />
            <Route path="privacy" element={<PatientPrivacy />} />
          </Route>

          {/* Pharmacist Routes */}
          <Route path="/pharmacist" element={<RoleLayout role="pharmacist" />}>
            <Route index element={<PharmacistHome />} />
            <Route path="orders" element={<PharmacistOrders />} />
            <Route path="inventory" element={<PharmacistInventory />} />
            <Route path="inventory/:id" element={<PharmacistProductDetails />} />
            <Route path="reports" element={<PharmacistReports />} />
            <Route path="prescriptions" element={<PharmacistPrescriptions />} />
            <Route path="profile" element={<PharmacistProfile />} />
          </Route>
          
          <Route path="/pharmacist/order/:id" element={<PharmacistOrderDetails />} />
          <Route path="/pharmacist/messages/:id" element={<Messages />} />

          {/* Delivery Routes */}
          <Route path="/delivery" element={<RoleLayout role="delivery" />}>
            <Route index element={<DeliveryHome />} />
            <Route path="history" element={<DeliveryHistory />} />
            <Route path="deliveries" element={<DeliveryActive />} />
            <Route path="profile" element={<DeliveryProfile />} />
          </Route>
          
          <Route path="/delivery/order/:id" element={<DeliveryOrderDetails />} />
          <Route path="/delivery/messages/:id" element={<Messages />} />

          {/* Admin Routes */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
             <Route path="clients" element={<AdminUsers type="clients" />} />
             <Route path="vendors" element={<AdminUsers type="vendors" />} />
             <Route path="drivers" element={<AdminUsers type="drivers" />} />
             <Route path="cashiers" element={<AdminUsers type="cashiers" />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="finances" element={<AdminFinances />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="audit" element={<AdminAuditLogs />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="settings/app" element={<AppSettings />} />
            <Route path="settings/website" element={<WebsiteSettings />} />
            <Route path="settings/promotions" element={<Promotions />} />
            <Route path="settings/delivery-zones" element={<DeliveryZones />} />
            <Route path="settings/compliance" element={<Compliance />} />
            <Route path="settings/security" element={<SecurityRoles />} />
            <Route path="settings/global" element={<GlobalSettings />} />
            <Route path="settings/theme" element={<ThemeSettings />} />
            <Route path="settings/financial" element={<FinancialSettings />} />
            <Route path="settings/vendors" element={<VendorSettings />} />
            <Route path="settings/catalog" element={<CatalogSettings />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="documentation" element={<AdminDocumentation />} />
            <Route path="changelog" element={<AdminChangelog />} />
          </Route>
        </Routes>
      </AppShell>
      </BrowserRouter>
      </AppUpdater>
      </ThemeProvider>
    </DarkModeProvider>
  );
}

