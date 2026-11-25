export interface AdminRegisteredCustomer {
  id: string;
  userId: string;
  customerId: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  savedAddresses?: any;
}

export const ADMIN_REGISTERED_CUSTOMERS: Record<string, AdminRegisteredCustomer> = {
  '9481086058': {
    id: 'cmw94l2n20000wjzxgg4horpr',
    userId: 'cmw94l2n20000wjzxgg4horpr',
    customerId: 'cmw94l2n30001wjzxvdx5qzvo',
    fullName: 'Rakshith',
    phone: '+91 9481086058',
    email: 'rakshith@gmail.com',
    role: 'CUSTOMER',
    savedAddresses: { preferredLanguage: 'en' },
  },
  '9587425635': {
    id: 'cmu6kf6eg0005e86ioiq0wjkl',
    userId: 'cmu6kf6eg0005e86ioiq0wjkl',
    customerId: 'cust-9587425635',
    fullName: 'Rakshith',
    phone: '+91 9587425635',
    email: 'rakshith.driver@gmail.com',
    role: 'CUSTOMER',
    savedAddresses: { preferredLanguage: 'en' },
  },
  '9999999999': {
    id: 'admin-master',
    userId: 'admin-master',
    customerId: 'cust-master',
    fullName: 'Master Admin',
    phone: '+91 9999999999',
    email: 'admin@kandycabs.com',
    role: 'ADMIN',
  },
  '8888888888': {
    id: 'driver-test-888',
    userId: 'driver-test-888',
    customerId: 'cust-test-888',
    fullName: 'Test Customer',
    phone: '+91 8888888888',
    email: 'test@kandycabs.com',
    role: 'CUSTOMER',
  },
};

export function getAdminRegisteredCustomer(phone?: string | null): AdminRegisteredCustomer | null {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  return ADMIN_REGISTERED_CUSTOMERS[clean] || null;
}
