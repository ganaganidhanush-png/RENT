import React, { Suspense } from 'react';
import AddTenantForm from '@/components/tenants/add-tenant-form';
import { Loader2 } from 'lucide-react';

export default function NewTenantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <AddTenantForm />
    </Suspense>
  );
}
